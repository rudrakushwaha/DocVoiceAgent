import os
from typing import List
from services.embeddings import embed_texts
from services.faiss_index import search_user_index
import openai

openai.api_key = os.environ.get('OPENAI_API_KEY')

CHAT_MODEL_DEFAULT = os.environ.get('OPENAI_CHAT_MODEL', 'gpt-3.5-turbo')

async def query_rag(userId: str, query: str, emotion: str = 'neutral'):
    # embed query
    q_emb = embed_texts([query])

    # search faiss
    results = search_user_index(userId, q_emb, top_k=5)
    sources = []
    context_texts = []
    for r in results:
        meta = r.get('meta') or {}
        sources.append(meta.get('chunkId') or meta.get('docId'))
        # We don't store chunk text in meta; in real system store text or fetch it
        context_texts.append(meta.get('preview', ''))

    prompt = build_prompt(query, context_texts, emotion)

    model_name = os.environ.get('OPENAI_CHAT_MODEL', CHAT_MODEL_DEFAULT)
    resp = openai.ChatCompletion.create(
        model=model_name,
        messages=[{'role':'system','content':'You are a helpful assistant.'},{'role':'user','content':prompt}],
        max_tokens=500
    )

    answer = resp['choices'][0]['message']['content']
    confidence = 0.8
    return { 'answer': answer, 'sources': sources, 'confidence': confidence }

def build_prompt(query: str, contexts: List[str], emotion: str):
    ctx = '\n\n'.join([c for c in contexts if c])
    prompt = f"User query: {query}\nEmotion: {emotion}\n\nContext:\n{ctx}\n\nProvide a concise answer and list sources."
    return prompt
