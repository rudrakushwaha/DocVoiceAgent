
import os
from services.embeddings import embed_texts
from services.faiss_index import search_user_index
import openai
from services.mongo import chunks_collection


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
            {"_id": 0, "chunkId": 1, "text": 1}
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
    if chunk_ids:
        chunk_docs = get_chunk_texts_by_ids(chunk_ids, userId)
        for doc in chunk_docs:
            text = doc.get("text", "")
            if text.strip():
                context_texts.append(text)
                sources.append(doc.get("chunkId"))
   
    # 5️⃣ Conversation history
    history_msgs = history[-8:] if history else []

    # 6️⃣ Build messages
    messages = [
        {
            "role": "system",
            "content": (
                "You are a document-grounded assistant.\n"
                "You must answer strictly using the DOCUMENT CONTEXT.\n"
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
    if context_texts:
        ctx = "\n\n".join(context_texts)

        print("\nCTX LENGTH:", len(ctx))
        print(ctx[:300])  # debug

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

    # 8️⃣ If model says 'The document does not contain this information', return empty sources
    if answer.strip().lower() == "the document does not contain this information.":
        sources = []

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
