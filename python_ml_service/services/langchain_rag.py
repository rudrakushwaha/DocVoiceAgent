import os
from typing import List
from services.embeddings import embed_texts
from services.faiss_index import search_user_index
import openai

openai.api_key = os.environ.get('OPENAI_API_KEY')

CHAT_MODEL_DEFAULT = os.environ.get('OPENAI_CHAT_MODEL', 'gpt-3.5-turbo')
RELEVANCE_THRESHOLD = float(os.environ.get('RELEVANCE_THRESHOLD', 0.65))  # Min similarity score

# Generic/chitchat keywords that don't need document context
GENERIC_KEYWORDS = [
    'hello', 'hi', 'how are you', 'what is your name', 'who are you',
    'tell me a joke', 'thanks', 'thank you', 'goodbye', 'bye',
    'what is', 'define', 'explain', 'how do', 'can you',
    'today', 'weather', 'time', 'date', 'who is'
]

def is_generic_query(query: str) -> bool:
    """Detect if query is generic/chitchat and doesn't need documents"""
    query_lower = query.lower().strip()
    
    # Remove punctuation for better matching
    import re
    query_clean = re.sub(r'[^\w\s]', ' ', query_lower)
    
    # Check for short generic queries
    if len(query_lower) < 60:  # Short queries are often generic
        # Check for generic keywords (word boundaries)
        for keyword in GENERIC_KEYWORDS:
            # Use word boundary matching for better accuracy
            if f' {keyword} ' in f' {query_clean} ':
                print(f"[DEBUG] Detected generic query: '{query}' (matched: '{keyword}')")
                return True
    
    # Also check if it STARTS with generic question words
    question_starts = ['who is', 'what is', 'how are', 'can you', 'do you', 'where is']
    for q_start in question_starts:
        if query_clean.startswith(q_start):
            print(f"[DEBUG] Detected generic query: '{query}' (starts with: '{q_start}')")
            return True
    
    return False

async def query_rag(userId: str, query: str, emotion: str = 'neutral', history: list = None):
    is_generic = is_generic_query(query)
    results = []
    sources = []
    context_texts = []
    if not is_generic:
        q_emb = embed_texts([query])
        results = search_user_index(userId, q_emb, top_k=5)
        relevant_results = [r for r in results if r.get('score', 0) >= RELEVANCE_THRESHOLD]
        print(f"Query: {query}")
        print(f"Total results: {len(results)}, Relevant (score >= {RELEVANCE_THRESHOLD}): {len(relevant_results)}")
        for r in relevant_results:
            meta = r.get('meta') or {}
            chunk_id = meta.get('chunkId') or meta.get('docId')
            score = r.get('score', 0)
            sources.append(chunk_id)
            context_texts.append(meta.get('preview', ''))
            print(f"  - {chunk_id}: score={score:.3f}")
    # Use last 8 messages from history if provided
    history_msgs = []
    if history and isinstance(history, list):
        history_msgs = history[-8:]
    # Build OpenAI messages list
    messages = [
        {'role': 'system', 'content': 'You are a helpful, document-grounded assistant. Answer user questions using your own knowledge and, if relevant, the provided document context.'}
    ]
    # Add conversation history
    for m in history_msgs:
        if m['role'] in ['user', 'assistant']:
            messages.append({'role': m['role'], 'content': m['content']})
    # Add current user query as the last user message
    messages.append({'role': 'user', 'content': query})
    # For document queries, add document context as a user message (so model uses it as context)
    if not is_generic and context_texts:
        ctx = '\n\n'.join([c for c in context_texts if c])
        if ctx:
            messages.append({'role': 'user', 'content': f'DOCUMENT CONTEXT:\n{ctx}'})
    model_name = os.environ.get('OPENAI_CHAT_MODEL', CHAT_MODEL_DEFAULT)
    resp = openai.ChatCompletion.create(
        model=model_name,
        messages=messages,
        max_tokens=500,
        temperature=0.7
    )
    answer = resp['choices'][0]['message']['content']
    confidence = 0.8
    return {
        'answer': answer,
        'sources': sources if not is_generic else [],
        'confidence': confidence,
        'is_generic': is_generic
    }

def build_prompt_with_history(query: str, contexts: list, emotion: str, is_generic: bool, history_msgs: list):
    # Deprecated: now handled by OpenAI messages list
    return ''
