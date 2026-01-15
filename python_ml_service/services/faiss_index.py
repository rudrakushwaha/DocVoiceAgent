import os
import json
import numpy as np
import faiss
from typing import List

BASE = os.path.join(os.getcwd(), 'indexes')
os.makedirs(BASE, exist_ok=True)

def _user_paths(userId: str):
    d = os.path.join(BASE, userId)
    os.makedirs(d, exist_ok=True)
    return d, os.path.join(d, 'index.faiss'), os.path.join(d, 'meta.json'), os.path.join(d, 'vectors.npy')

def _load_meta(meta_path):
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf8') as f:
            return json.load(f)
    return { 'next_id': 1, 'items': {} }

def _save_meta(meta_path, meta):
    with open(meta_path, 'w', encoding='utf8') as f:
        json.dump(meta, f)

def _ensure_index(index_path, dim=384):
    if os.path.exists(index_path):
        index = faiss.read_index(index_path)
    else:
        index_flat = faiss.IndexFlatIP(dim)
        index = faiss.IndexIDMap(index_flat)
        faiss.write_index(index, index_path)
    return index

def add_chunks_to_index(userId: str, docId: str, chunk_objs: List[dict], embeddings: np.ndarray) -> List[int]:
    # embeddings shape (N, dim)
    d, index_path, meta_path, vectors_path = _user_paths(userId)
    dim = embeddings.shape[1]
    index = _ensure_index(index_path, dim=dim)

    # Load existing vectors store
    if os.path.exists(vectors_path):
        stored_vectors = np.load(vectors_path, allow_pickle=True).item()
    else:
        stored_vectors = {}

    meta = _load_meta(meta_path)
    ids = []
    vectors = []
    for i, obj in enumerate(chunk_objs):
        eid = meta['next_id']
        meta['next_id'] = eid + 1
        meta['items'][str(eid)] = { 'chunkId': obj['chunkId'], 'docId': docId, 'order': obj.get('order', 0) }
        ids.append(eid)
        vec = embeddings[i].astype('float32')
        vectors.append(vec)
        stored_vectors[eid] = vec  # Store vector with its ID

    if vectors:
        xb = np.vstack(vectors)
        index.add_with_ids(xb, np.array(ids, dtype='int64'))
        faiss.write_index(index, index_path)
        _save_meta(meta_path, meta)
        np.save(vectors_path, stored_vectors)  # Save vectors store

    return ids

def search_user_index(userId: str, query_emb, top_k=5):
    _, index_path, meta_path, _ = _user_paths(userId)
    if not os.path.exists(index_path):
        return []
    index = faiss.read_index(index_path)
    D, I = index.search(query_emb.astype('float32'), top_k)
    meta = _load_meta(meta_path)
    results = []
    for dist_row, id_row in zip(D, I):
        for dist, idx in zip(dist_row, id_row):
            if idx == -1: continue
            item = meta['items'].get(str(int(idx)))
            results.append({ 'faissIndex': int(idx), 'score': float(dist), 'meta': item })
    return results

def delete_document_vectors(userId: str, docId: str):
    """
    Delete all vectors for a document and rebuild FAISS with sequential IDs starting from 1.
    
    Steps:
    1. Load meta.json and vectors store
    2. Filter out items where docId matches
    3. Get remaining vectors from stored vectors
    4. Create NEW FAISS index with IDs: 1, 2, 3, ...
    5. Create NEW meta.json with IDs: 1, 2, 3, ...
    6. Save both
    """
    import logging
    import numpy as np
    import faiss
    
    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger(__name__)
    
    d, index_path, meta_path, vectors_path = _user_paths(userId)
    
    try:
        # STEP 1: Load meta.json
        print(f"\n{'='*60}")
        print(f"DELETE DOCUMENT: userId={userId}, docId={docId}")
        print(f"{'='*60}")
        print(f"\nSTEP 1: Load meta.json from {meta_path}")
        
        meta = _load_meta(meta_path)
        old_count = len(meta['items'])
        print(f"  ✓ Loaded meta.json with {old_count} vectors")
        
        # STEP 2: Filter items by docId
        print(f"\nSTEP 2: Filter items (remove docId={docId})")
        
        remaining_chunks = []
        deleted_ids = []
        
        for old_id_str, item in sorted(meta['items'].items(), key=lambda x: int(x[0])):
            old_id = int(old_id_str)
            if str(item.get('docId')) == str(docId):
                deleted_ids.append(old_id)
                print(f"  ✗ DELETE: ID {old_id} → docId={item.get('docId')}")
            else:
                remaining_chunks.append({
                    'old_id': old_id,
                    'chunkId': item['chunkId'],
                    'docId': item['docId'],
                    'order': item.get('order', 0)
                })
                print(f"  ✓ KEEP: ID {old_id} → docId={item.get('docId')}")
        
        deleted_count = len(deleted_ids)
        new_count = len(remaining_chunks)
        
        print(f"\n  Summary: {deleted_count} deleted, {new_count} remaining")
        
        if deleted_count == 0:
            print(f"  ⚠ No vectors found for docId={docId}")
            return
        
        # STEP 3: Handle empty case
        if new_count == 0:
            print(f"\nSTEP 3-6: No vectors remaining → Clear everything")
            if os.path.exists(index_path):
                os.remove(index_path)
                print(f"  ✓ Deleted FAISS index file")
            if os.path.exists(vectors_path):
                os.remove(vectors_path)
                print(f"  ✓ Deleted vectors store file")
            
            _save_meta(meta_path, {'next_id': 1, 'items': {}})
            print(f"  ✓ Saved empty meta.json")
            print(f"\n{'='*60}")
            print(f"COMPLETE: Deleted {deleted_count} vectors, 0 remaining")
            print(f"{'='*60}\n")
            return
        
        # STEP 3: Load stored vectors
        print(f"\nSTEP 3: Load stored vectors from {vectors_path}")
        
        if not os.path.exists(vectors_path):
            print(f"  ✗ ERROR: Vectors store not found at {vectors_path}")
            return
        
        stored_vectors = np.load(vectors_path, allow_pickle=True).item()
        print(f"  ✓ Loaded {len(stored_vectors)} stored vectors")
        
        # STEP 4: Get remaining vectors from store
        print(f"\nSTEP 4: Extract {new_count} remaining vectors from store")
        
        remaining_vectors = []
        for chunk in remaining_chunks:
            old_id = chunk['old_id']
            if old_id in stored_vectors:
                remaining_vectors.append(stored_vectors[old_id])
                print(f"  ✓ Retrieved vector for old_id={old_id}")
            else:
                print(f"  ✗ Vector not found for old_id={old_id}")
        
        if len(remaining_vectors) != new_count:
            print(f"  ✗ ERROR: Only found {len(remaining_vectors)}/{new_count} vectors in store")
            return
        
        # Get dimension from first vector
        dim = remaining_vectors[0].shape[0]
        print(f"  ✓ Vector dimension: {dim}")
        
        # STEP 5: Create NEW FAISS with sequential IDs
        print(f"\nSTEP 5: Create NEW FAISS index with sequential IDs")
        
        index_flat = faiss.IndexFlatIP(dim)
        new_index = faiss.IndexIDMap(index_flat)
        
        # NEW sequential IDs: 1, 2, 3, ...
        new_ids = list(range(1, new_count + 1))
        vectors_array = np.vstack(remaining_vectors).astype('float32')
        new_index.add_with_ids(vectors_array, np.array(new_ids, dtype='int64'))
        
        print(f"  ✓ Created FAISS index with IDs: {new_ids}")
        
        # STEP 6: Create NEW meta.json and vectors store with sequential IDs
        print(f"\nSTEP 6: Create NEW meta.json and vectors store with sequential IDs")
        
        new_meta_items = {}
        new_stored_vectors = {}
        for i in range(len(remaining_chunks)):
            new_id = i + 1  # 1, 2, 3, ...
            chunk = remaining_chunks[i]
            new_meta_items[str(new_id)] = {
                'chunkId': chunk['chunkId'],
                'docId': chunk['docId'],
                'order': chunk['order']
            }
            new_stored_vectors[new_id] = remaining_vectors[i]  # Store with new ID
            print(f"  ✓ ID {new_id} → chunkId={chunk['chunkId'][:20]}..., docId={chunk['docId']}")
        
        next_id = new_count + 1
        new_meta = {'next_id': next_id, 'items': new_meta_items}
        
        # STEP 7: Save everything
        print(f"\nSTEP 7: Save FAISS index, meta.json, and vectors store")
        
        faiss.write_index(new_index, index_path)
        print(f"  ✓ Saved FAISS index to {index_path}")
        
        _save_meta(meta_path, new_meta)
        print(f"  ✓ Saved meta.json to {meta_path}")
        
        np.save(vectors_path, new_stored_vectors)
        print(f"  ✓ Saved vectors store to {vectors_path}")
        
        # STEP 8: Verification
        print(f"\nSTEP 8: Verification")
        print(f"  Old vector count: {old_count}")
        print(f"  Deleted vectors: {deleted_count}")
        print(f"  New vector count: {new_count}")
        print(f"  Next ID: {next_id}")
        print(f"  FAISS IDs: {new_ids}")
        print(f"  Meta IDs: {sorted([int(k) for k in new_meta_items.keys()])}")
        
        # Verify no gaps
        meta_ids = sorted([int(k) for k in new_meta_items.keys()])
        expected_ids = list(range(1, new_count + 1))
        if meta_ids == expected_ids:
            print(f"  ✓ NO GAPS: IDs are sequential 1-{new_count}")
        else:
            print(f"  ✗ ERROR: IDs have gaps!")
        
        print(f"\n{'='*60}")
        print(f"COMPLETE: Deleted {deleted_count} vectors, {new_count} remaining")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
