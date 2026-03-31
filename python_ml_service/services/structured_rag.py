import os
from services.embeddings import embed_texts
from services.faiss_index import search_user_index
import openai
from services.mongo import chunks_collection
import re
from datetime import datetime
import json

openai.api_key = os.environ.get("OPENAI_API_KEY")

def extract_datetime_info(text):
    """Extract date and time information from text using regex patterns"""
    datetime_patterns = [
        r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b',  # MM/DD/YYYY or MM-DD-YYYY
        r'\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b',  # YYYY/MM/DD or YYYY-MM-DD
        r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',  # Month DD, YYYY
        r'\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\b',  # Time HH:MM AM/PM
        r'\b(\d{1,2}:\d{2}:\d{2})\b',  # Time HH:MM:SS
    ]
    
    dates = []
    times = []
    
    for pattern in datetime_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if any(x in match for x in [':', 'AM', 'PM', 'am', 'pm']):
                times.append(match if isinstance(match, str) else ' '.join(match))
            else:
                dates.append(match if isinstance(match, str) else '/'.join(match))
    
    return list(set(dates)), list(set(times))

async def query_structured_rag(
    userId: str,
    query: str,
    emotion: str = "neutral",
    history: list = None
):
    """
    Query RAG and return structured data with date, time, and title information
    """
    
    # 1️⃣ Embed query
    query_embedding = embed_texts([query])
    
    # 2️⃣ FAISS search
    results = search_user_index(userId, query_embedding, top_k=10)
    
    print(f"\nStructured Query: {query}")
    print(f"Total retrieved chunks: {len(results)}")
    
    # 3️⃣ Convert FAISS distance → similarity
    relevant_results = []
    chunk_ids = []
    
    for r in results:
        distance = r.get("score", 999)
        similarity = 1 / (1 + distance)
        r["similarity"] = similarity
        
        if similarity >= 0.3:  # Lower threshold for structured data
            relevant_results.append(r)
            meta = r.get("meta", {})
            chunk_id = meta.get("chunkId")
            if chunk_id:
                chunk_ids.append(chunk_id)
    
    # 4️⃣ Fetch chunk texts from MongoDB
    structured_data = []
    
    if chunk_ids:
        chunk_docs = list(
            chunks_collection.find(
                {
                    "chunkId": {"$in": chunk_ids},
                    "userId": userId
                },
                {"_id": 0, "chunkId": 1, "docId": 1, "docName": 1, "pageNumber": 1, "text": 1}
            )
        )
        
        for doc in chunk_docs:
            text = doc.get("text", "")
            if not text:
                continue
                
            # Extract date and time from text
            dates, times = extract_datetime_info(text)
            
            # Create title from doc name and page
            title = f"{doc.get('docName', 'Unknown Document')} - Page {doc.get('pageNumber', 1)}"
            
            # Extract key information using LLM for better title generation
            try:
                title_prompt = f"""
                Extract a meaningful title from this document snippet (max 60 characters):
                Text: {text[:200]}
                
                Return only the title, no quotes.
                """
                
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": title_prompt}],
                    temperature=0.3,
                    max_tokens=50
                )
                
                generated_title = response.choices[0].message.content.strip()
                if generated_title and len(generated_title) > 5:
                    title = generated_title
                    
            except Exception as e:
                print(f"Title generation failed: {e}")
            
            # Create structured entry
            structured_entry = {
                "title": title,
                "date": dates[0] if dates else None,
                "time": times[0] if times else None,
                "content": text[:500],  # First 500 chars as preview
                "docName": doc.get("docName"),
                "pageNumber": doc.get("pageNumber"),
                "chunkId": doc.get("chunkId"),
                "similarity": next((r["similarity"] for r in relevant_results 
                                 if r.get("meta", {}).get("chunkId") == doc.get("chunkId")), 0)
            }
            
            structured_data.append(structured_entry)
    
    # Sort by similarity (highest first)
    structured_data.sort(key=lambda x: x["similarity"], reverse=True)
    
    # 5️⃣ Generate summary using LLM
    summary = ""
    if structured_data:
        try:
            context = "\n\n".join([f"[{i+1}] {item['title']}: {item['content'][:200]}" 
                                   for i, item in enumerate(structured_data[:5])])
            
            summary_prompt = f"""
            Based on the following document excerpts, provide a concise summary that answers: "{query}"
            
            Document excerpts:
            {context}
            
            Summary:
            """
            
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": summary_prompt}],
                temperature=0.3,
                max_tokens=300
            )
            
            summary = response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"Summary generation failed: {e}")
            summary = f"Found {len(structured_data)} relevant document sections."
    
    return {
        "structured_data": structured_data,
        "summary": summary,
        "total_results": len(structured_data),
        "query": query
    }
