import importlib
import numpy as np

_model = None

def get_model():
    global _model
    if _model is None:
        try:
            SentenceTransformer = importlib.import_module('sentence_transformers').SentenceTransformer
        except Exception as e:
            raise ImportError('sentence-transformers is required for embeddings. Install it into the service venv: pip install sentence-transformers') from e
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model

def embed_texts(texts):
    """Embed texts using local sentence-transformers and return normalized numpy embeddings."""
    model = get_model()
    embs = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    norms = np.linalg.norm(embs, axis=1, keepdims=True)
    norms[norms==0] = 1.0
    embs = embs / norms
    return embs
