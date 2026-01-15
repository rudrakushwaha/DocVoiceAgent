"""
Utility script to clear FAISS storage for a specific user.
This will delete all vectors, FAISS index, and reset meta.json.
"""
import os
import json
import sys

def clear_user_storage(userId: str):
    """Clear all FAISS storage for a user"""
    base_path = os.path.join(os.getcwd(), 'indexes', userId)
    
    if not os.path.exists(base_path):
        print(f"No storage found for userId: {userId}")
        return
    
    index_path = os.path.join(base_path, 'index.faiss')
    meta_path = os.path.join(base_path, 'meta.json')
    vectors_path = os.path.join(base_path, 'vectors.npy')
    
    # Remove files
    removed = []
    if os.path.exists(index_path):
        os.remove(index_path)
        removed.append('index.faiss')
    
    if os.path.exists(vectors_path):
        os.remove(vectors_path)
        removed.append('vectors.npy')
    
    # Reset meta.json
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump({'next_id': 1, 'items': {}}, f)
    removed.append('meta.json (reset)')
    
    print(f"✓ Cleared storage for userId: {userId}")
    print(f"  Removed/Reset: {', '.join(removed)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python clear_faiss_storage.py <userId>")
        print("Example: python clear_faiss_storage.py 4nysSJ3y5eTxOkzTIrEM87o18Ix2")
        sys.exit(1)
    
    userId = sys.argv[1]
    clear_user_storage(userId)
