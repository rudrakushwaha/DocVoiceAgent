import io
import re
from typing import List
from pdfminer.high_level import extract_text as pdf_extract_text
import docx
import nltk

try:
    nltk.data.find('tokenizers/punkt')
except Exception:
    nltk.download('punkt')

def extract_text_from_file(content: bytes, source_url: str = '') -> str:
    # try pdf
    text = ''
    try:
        if source_url.lower().endswith('.pdf') or b'%PDF' in content[:4]:
            with io.BytesIO(content) as fh:
                text = pdf_extract_text(fh)
            return text
    except Exception:
        pass

    try:
        if source_url.lower().endswith('.docx'):
            with io.BytesIO(content) as fh:
                doc = docx.Document(fh)
                text = '\n'.join([p.text for p in doc.paragraphs])
            return text
    except Exception:
        pass

    # fallback: decode
    try:
        text = content.decode('utf-8')
    except Exception:
        text = ''
    return text

def chunk_text(text: str, min_tokens=500, max_tokens=700) -> List[dict]:
    # approximate tokens by words
    words = re.split(r'\s+', text.strip())
    if not words:
        return []

    avg_token_per_word = 0.75
    target_words = int((min_tokens + max_tokens) / 2 * (1/avg_token_per_word))

    chunks = []
    i = 0
    idx = 0
    while i < len(words):
        part = words[i:i+target_words]
        chunk_text = ' '.join(part).strip()
        if chunk_text:
            chunks.append({ 'chunkId': None, 'text': chunk_text, 'order': idx })
            idx += 1
        i += target_words
    return chunks
