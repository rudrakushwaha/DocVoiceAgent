import os
from services.embeddings import embed_texts
from services.faiss_index import search_user_index
import openai

openai.api_key = os.environ.get("OPENAI_API_KEY")

CHAT_MODEL_DEFAULT = os.environ.get("OPENAI_CHAT_MODEL", "gpt-3.5-turbo")
RELEVANCE_THRESHOLD = float(os.environ.get("RELEVANCE_THRESHOLD", 0.60))


async def query_rag(
    userId: str,
    query: str,
    emotion: str = "neutral",
    history: list = None
):
    sources = []
    context_texts = []

    # 1️⃣ Embed query
    query_embedding = embed_texts([query])

    # 2️⃣ FAISS search
    results = search_user_index(userId, query_embedding, top_k=5)

    print(f"\nQuery: {query}")
    print(f"Total retrieved chunks: {len(results)}")

    # 3️⃣ Convert FAISS distance → similarity
    relevant_results = []

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

    print(
        f"Relevant (similarity >= {RELEVANCE_THRESHOLD}): "
        f"{len(relevant_results)}"
    )

    # ======================================================
    # ✅ FIXED BLOCK — THIS WAS THE MAIN ISSUE
    # ======================================================
    # 4️⃣ Collect REAL document text (not preview)
    for r in relevant_results:
        meta = r.get("meta", {})

        chunk_id = meta.get("chunkId") or meta.get("docId")

        # 🔥 this is the actual chunk text
        text = (
            meta.get("text")
            or meta.get("chunk")
            or meta.get("content")
            or meta.get("page_content")
            or meta.get("preview", "")
        )

        if text.strip():
            context_texts.append(text)

        if chunk_id:
            sources.append(chunk_id)

    # ======================================================

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
