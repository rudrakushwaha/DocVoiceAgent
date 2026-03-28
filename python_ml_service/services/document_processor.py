"""import os
import io
import requests
import uuid
from typing import List

from utils.text_utils import extract_text_from_file, chunk_text
from services.embeddings import embed_texts
from services.faiss_index import add_chunks_to_index

async def process_document(docId: str, userId: str, fileUrl: str):
    # download file
    r = requests.get(fileUrl, stream=True, timeout=60)
    r.raise_for_status()
    content = r.content

    # extract text
    pages = extract_text_from_file(content, fileUrl)

    # chunk text

    chunks = []

    for page in pages:
        page_chunks = chunk_text(page["text"])

        for c in page_chunks:
            chunks.append({
                "text": c["text"],
                "pageNumber": page["pageNumber"]
            })


    # embed in batches
    texts = [c['text'] for c in chunks]
    embeddings = embed_texts(texts)

    # prepare chunk objects
    chunk_objs = []
    for i, c in enumerate(chunks):
        chunkId = c.get('chunkId') or f"{docId}-{i}-{uuid.uuid4().hex[:8]}"
        chunk_objs.append({ 'chunkId': chunkId, 'text': c['text'],'pageNumber': c['pageNumber'], 'order': i })

    # add to FAISS
    faiss_ids = add_chunks_to_index(userId, docId, chunk_objs, embeddings)

    # return list
    result = []
    for obj, fid in zip(chunk_objs, faiss_ids):
        result.append({ 'chunkId': obj['chunkId'], 'faissIndex': int(fid), 'text': obj['text'],  'pageNumber': obj['pageNumber'], 'order': obj['order'] })

    return result
"""

import os
import io
import requests
import uuid
from typing import List

from utils.text_utils import extract_text_from_file, chunk_text
from services.embeddings import embed_texts
from services.faiss_index import add_chunks_to_index
from services.mongo import chunks_collection   # ✅ ADDED

async def process_document(docId: str, userId: str, fileUrl: str):
    # 1️⃣ download file
    r = requests.get(fileUrl, stream=True, timeout=60)
    r.raise_for_status()
    content = r.content

    # 2️⃣ extract text
    pages = extract_text_from_file(content, fileUrl)

    # 3️⃣ chunk text
    chunks = []

    for page in pages:
        page_chunks = chunk_text(page["text"])

        for c in page_chunks:
            chunks.append({
                "text": c["text"],
                "pageNumber": page["pageNumber"]
            })

    # 4️⃣ embed in batches
    texts = [c['text'] for c in chunks]
    embeddings = embed_texts(texts)

    # 5️⃣ prepare chunk objects (SINGLE SOURCE OF TRUTH)
    chunk_objs = []
    docs_to_insert = []

    for i, c in enumerate(chunks):
        chunkId = f"{docId}-{i}-{uuid.uuid4().hex[:8]}"  # ✅ UNIQUE + CONSISTENT

        obj = {
            'chunkId': chunkId,
            'text': c['text'],
            'pageNumber': c['pageNumber'],
            'order': i
        }

        chunk_objs.append(obj)

        # ✅ Prepare Mongo document
        docs_to_insert.append({
            "chunkId": chunkId,
            "docId": docId,
            "userId": str(userId),   # ✅ FORCE STRING CONSISTENCY
            "text": c["text"],
            "pageNumber": c["pageNumber"],
            "order": i
        })

    # 6️⃣ SAVE TO MONGO FIRST (VERY IMPORTANT)
    if docs_to_insert:
        chunks_collection.insert_many(docs_to_insert)
        print(f"✅ Inserted {len(docs_to_insert)} chunks into MongoDB")

    # 7️⃣ ADD TO FAISS (same chunkIds)
    faiss_ids = add_chunks_to_index(userId, docId, chunk_objs, embeddings)

    # 8️⃣ return response
    result = []
    for obj, fid in zip(chunk_objs, faiss_ids):
        result.append({
            'chunkId': obj['chunkId'],
            'faissIndex': int(fid),
            'text': obj['text'],
            'pageNumber': obj['pageNumber'],
            'order': obj['order']
        })

    return result