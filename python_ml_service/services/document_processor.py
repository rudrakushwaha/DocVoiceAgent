import os
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
    text = extract_text_from_file(content, fileUrl)

    # chunk text
    chunks = chunk_text(text, min_tokens=500, max_tokens=700)

    # embed in batches
    texts = [c['text'] for c in chunks]
    embeddings = embed_texts(texts)

    # prepare chunk objects
    chunk_objs = []
    for i, c in enumerate(chunks):
        chunkId = c.get('chunkId') or f"{docId}-{i}-{uuid.uuid4().hex[:8]}"
        chunk_objs.append({ 'chunkId': chunkId, 'text': c['text'], 'order': i })

    # add to FAISS
    faiss_ids = add_chunks_to_index(userId, docId, chunk_objs, embeddings)

    # return list
    result = []
    for obj, fid in zip(chunk_objs, faiss_ids):
        result.append({ 'chunkId': obj['chunkId'], 'faissIndex': int(fid), 'text': obj['text'] })

    return result
