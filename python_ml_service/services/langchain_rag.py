
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

    # 6️⃣ Build emotional response behavior
    EMOTION_CONFIG = {
        "frustrated": {
            "system_instruction": (
                "CRITICAL: The user is FRUSTRATED. Your response MUST:\n"
                "1. START with empathy: Acknowledge their frustration explicitly\n"
                "2. SIMPLIFY: Use short sentences, avoid jargon, break complex ideas into bite-sized pieces\n"
                "3. BE SUPPORTIVE: Use warm, reassuring language\n"
                "4. ORGANIZE: Use bullet points or numbered lists for clarity\n"
                "5. OFFER SOLUTIONS: Suggest next steps or alternatives\n\n"
                "Example opening: 'I understand this is frustrating. Let me break this down...'\n"
                "Response length: Keep to 2-3 paragraphs MAX, then offer to clarify further.\n"
                "Tone: Calm, patient, encouraging"
            ),
            "temperature": 0.3,  # More conservative/predictable
            "max_tokens": 400
        },
        "confused": {
            "system_instruction": (
                "CRITICAL: The user is CONFUSED. Your response MUST:\n"
                "1. START by validating: 'That's a great question' / 'This can be confusing'\n"
                "2. STRUCTURE: Provide step-by-step explanation with clear transitions\n"
                "3. USE EXAMPLES: Include concrete examples from the document\n"
                "4. DEFINE TERMS: Explain any technical terms or concepts\n"
                "5. CHECK UNDERSTANDING: End with 'Does this help?' or offer further clarification\n\n"
                "Example structure:\n"
                "  • First, let's understand...\n"
                "  • Second, the key point is...\n"
                "  • Finally, this means...\n"
                "Response length: Detailed (3-4 paragraphs), include examples\n"
                "Tone: Patient, educational, supportive"
            ),
            "temperature": 0.25,  # Even more controlled
            "max_tokens": 550
        },
        "sad": {
            "system_instruction": (
                "CRITICAL: The user is SAD or dejected. Your response MUST:\n"
                "1. ACKNOWLEDGE: Recognize their emotional state with compassion\n"
                "2. ENCOURAGE: Provide frames for positive perspective\n"
                "3. HIGHLIGHT SOLUTIONS: Focus on what CAN be done\n"
                "4. BE SUPPORTIVE: Gentle and understanding tone throughout\n"
                "5. OFFER HOPE: End with constructive next steps\n\n"
                "Example opening: 'I hear you. Let's look at this from a different angle...'\n"
                "Response length: Moderate (2-3 paragraphs), balanced\n"
                "Tone: Warm, compassionate, encouraging, supportive"
            ),
            "temperature": 0.35,
            "max_tokens": 450
        },
        "happy": {
            "system_instruction": (
                "CRITICAL: The user is HAPPY and positive. Your response SHOULD:\n"
                "1. MATCH ENERGY: Be enthusiastic and engaging\n"
                "2. BE CONVERSATIONAL: Use a friendly, natural tone\n"
                "3. CELEBRATE: Acknowledge the positive momentum\n"
                "4. PROVIDE INSIGHTS: Go deeper with confidence\n"
                "5. ENCOURAGE EXPLORATION: Suggest related topics or next steps\n\n"
                "Example opening: 'Great question! Let me share more details...'\n"
                "Response length: Can be more detailed and exploratory (3-4 paragraphs)\n"
                "Tone: Friendly, enthusiastic, engaging, collaborative"
            ),
            "temperature": 0.5,  # More creative/varied
            "max_tokens": 550
        },
        "neutral": {
            "system_instruction": (
                "NEUTRAL TONE: The user has a neutral emotional stance. Your response SHOULD:\n"
                "1. BE FACTUAL: Stick to accurate, document-grounded information\n"
                "2. BE CONCISE: Use clear, direct language without unnecessary elaboration\n"
                "3. BE STRUCTURED: Organize logically with clear sections\n"
                "4. BE HELPFUL: Provide actionable information\n"
                "5. BE NEUTRAL: Maintain professional, balanced perspective\n\n"
                "Response structure: Introduction → Key points → Sources cited\n"
                "Response length: Concise (2-3 paragraphs)\n"
                "Tone: Professional, factual, clear"
            ),
            "temperature": 0.2,  # Very factual
            "max_tokens": 400
        }
    }

    # Get emotion config (default to neutral)
    emotion_lower = emotion.lower() if emotion else "neutral"
    emotion_cfg = EMOTION_CONFIG.get(emotion_lower, EMOTION_CONFIG["neutral"])
    
    system_instruction = emotion_cfg["system_instruction"]
    response_temperature = emotion_cfg["temperature"]
    response_max_tokens = emotion_cfg["max_tokens"]

    messages = [
        {
            "role": "system",
            "content": (
                "You are a document-grounded assistant.\n"
                "You must answer strictly using the DOCUMENT CONTEXT.\n"
                "After each factual statement, cite the source number in square brackets.\n"
                "If the answer is not explicitly present, say:\n"
                "'The document does not contain this information.'\n\n"
                "---EMOTION-AWARE BEHAVIOR---\n"
                f"{system_instruction}"
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

    # 7️⃣ LLM call with emotion-aware parameters
    model_name = os.environ.get(
        "OPENAI_CHAT_MODEL", CHAT_MODEL_DEFAULT
    )

    response = openai.ChatCompletion.create(
        model=model_name,
        messages=messages,
        temperature=response_temperature,  # Emotion-based
        max_tokens=response_max_tokens,    # Emotion-based
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
