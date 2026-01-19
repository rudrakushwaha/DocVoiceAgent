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

async def query_rag(userId: str, query: str, emotion: str = 'neutral'):
    # Check if query is generic (doesn't need documents)
    is_generic = is_generic_query(query)
    
    results = []
    sources = []
    context_texts = []
    
    # Only search documents if query is specific
    if not is_generic:
        # embed query
        q_emb = embed_texts([query])

        # search faiss
        results = search_user_index(userId, q_emb, top_k=5)
        
        # Filter results by relevance threshold
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

    prompt = build_prompt(query, context_texts, emotion, is_generic)

    model_name = os.environ.get('OPENAI_CHAT_MODEL', CHAT_MODEL_DEFAULT)
    resp = openai.ChatCompletion.create(
        model=model_name,
        messages=[{'role':'system','content':'You are a helpful assistant.'},{'role':'user','content':prompt}],
        max_tokens=500
    )

    answer = resp['choices'][0]['message']['content']
    confidence = 0.8
    
    return { 
        'answer': answer, 
        'sources': sources if not is_generic else [],  # No sources for generic queries
        'confidence': confidence,
        'is_generic': is_generic
    }

def build_prompt(query: str, contexts: List[str], emotion: str, is_generic: bool = False):
    if is_generic:
        # For generic queries, don't include document context
        prompt = f"User query: {query}\nEmotion: {emotion}\n\nProvide a helpful and concise answer."
    else:
        ctx = '\n\n'.join([c for c in contexts if c])
        if ctx:
            prompt = f"User query: {query}\nEmotion: {emotion}\n\nContext from documents:\n{ctx}\n\nProvide a concise answer based on the documents if relevant, otherwise provide your own knowledge."
        else:
            prompt = f"User query: {query}\nEmotion: {emotion}\n\nNo relevant documents found. Provide a helpful answer based on your knowledge."
    return prompt
