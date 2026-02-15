
import os
from services.embeddings import embed_texts
from services.faiss_index import search_user_index
import openai
from services.mongo import chunks_collection
from utils.text_utils import extract_best_sentence
import re

openai.api_key = os.environ.get("OPENAI_API_KEY")

CHAT_MODEL_DEFAULT = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4.1-mini")
RELEVANCE_THRESHOLD = float(os.environ.get("RELEVANCE_THRESHOLD", 0.60))

def get_chunk_texts_by_ids(chunk_ids, userId):
    if not chunk_ids:
        return []

    return list(
        chunks_collection.find(
            {
                "chunkId": {"$in": chunk_ids},
                "userId": userId
            },
            {"_id": 0,
            "chunkId": 1, 
            "docId": 1,
            "docName": 1,
            "pageNumber": 1,
            "text": 1}
        )
    )


async def query_rag(
    userId: str,
    query: str,
    emotion: str = "neutral",
    history: list = None
):

    # 1️⃣ Embed query
    query_embedding = embed_texts([query])

    # 2️⃣ FAISS search
    results = search_user_index(userId, query_embedding, top_k=5)

    print(f"\nQuery: {query}")
    print(f"Total retrieved chunks: {len(results)}")

    # 3️⃣ Convert FAISS distance → similarity
    relevant_results = []
    chunk_ids = []

    for r in results:
        distance = r.get("score", 999)
        similarity = 1 / (1 + distance)
        r["similarity"] = similarity

        print(
            f"RAW DISTANCE: {distance:.4f} "
            f"=> SIMILARITY: {similarity:.3f}"
        )

        if similarity >= RELEVANCE_THRESHOLD:
            relevant_results.append(r)

            meta = r.get("meta", {})
            chunk_id = meta.get("chunkId")

            if chunk_id:
                chunk_ids.append(chunk_id)


    print(
        f"Relevant (similarity >= {RELEVANCE_THRESHOLD}): "
        f"{len(relevant_results)}"
    )

    # 4️⃣ Fetch chunk texts from MongoDB
    context_texts = []
    sources = []
    context_blocks = []
    
    if chunk_ids:
        chunk_docs = get_chunk_texts_by_ids(chunk_ids, userId)

        for idx, doc in enumerate(chunk_docs, start=1):
            text = doc.get("text", "")
            
            if not text:
                continue

            # Build labeled context block
            block = f"[{idx}] {doc['docName']} (Page {doc['pageNumber']})\n{text}"
            context_blocks.append(block)

            # Build source metadata (no best_sentence)
            sources.append({
                "number": idx,
                "chunkId": doc.get("chunkId"),
                "docName": doc.get("docName"),
                "pageNumber": doc.get("pageNumber"),
                "snippet": text[:300]
            })  
                

   
    # 5️⃣ Conversation history
    history_msgs = history[-8:] if history else []

    # 6️⃣ Build messages
    messages = [
        {
            "role": "system",
            "content": (
                "You are a document-grounded assistant.\n"
                "You must answer strictly using the DOCUMENT CONTEXT.\n"
                "After each factual statement, cite the source number in square brackets.\n"
                "If the answer is not explicitly present, say:\n"
                "'The document does not contain this information.'"
            )
        }
    ]

    # add history
    for m in history_msgs:
        if m.get("role") in ("user", "assistant"):
            messages.append(m)


    # document context FIRST
    if context_blocks:
        ctx = "\n\n".join(context_blocks)

        messages.append(
            {
                "role": "system",
                "content": f"DOCUMENT CONTEXT:\n{ctx}"
            }
        )

    # user query LAST
    messages.append(
        {
            "role": "user",
            "content": query
        }
    )

    # 7️⃣ LLM call
    model_name = os.environ.get(
        "OPENAI_CHAT_MODEL", CHAT_MODEL_DEFAULT
    )

    response = openai.ChatCompletion.create(
        model=model_name,
        messages=messages,
        temperature=0.2,
        max_tokens=500,
    )

    answer = response["choices"][0]["message"]["content"]

    # citation numbers inside the llm output answer
    used_numbers = set(map(int, re.findall(r'\[(\d+)\]', answer)))

    

    # 8️⃣ If model says 'The document does not contain this information', return empty sources
    if answer.strip().lower() == "the document does not contain this information.":
        sources = []

    sources = [s for s in sources if s["number"] in used_numbers]

    confidence = round(
        sum(r["similarity"] for r in relevant_results)
        / max(len(relevant_results), 1),
        2
    )

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence
    }
