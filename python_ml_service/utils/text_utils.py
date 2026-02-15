import io
import re
from typing import List
from pdfminer.high_level import extract_pages 
from pdfminer.layout import LTTextContainer
import docx
import nltk


import re
from services.embeddings import embed_texts

try:
    nltk.data.find('tokenizers/punkt')
except Exception:
    nltk.download('punkt')

def extract_text_from_file(content: bytes, source_url: str = ''):

    if source_url.lower().endswith('.pdf') or b'%PDF' in content[:4]:
        pages = []

        for page_number, page_layout in enumerate(
            extract_pages(io.BytesIO(content)),
            start=1
        ):
            page_text = ""

            for element in page_layout:
                if isinstance(element, LTTextContainer):
                    page_text += element.get_text()
                    page_text = re.sub(r'\s+', ' ', page_text)
                    page_text = re.sub(r'([A-Z]\s){3,}', '', page_text)

            pages.append({
                "pageNumber": page_number,
                "text": page_text.strip()
            })

        return pages

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



def extract_best_sentence(query, chunk_text):
    sentences = re.split(r'(?<=[.!?])\s+', chunk_text)

    if not sentences:
        return chunk_text[:300]

    # Embed query once
    query_embedding = embed_texts([query])[0]

    # Embed sentences
    sentence_embeddings = embed_texts(sentences)

    best_score = -1
    best_sentence = sentences[0]

    for sentence, emb in zip(sentences, sentence_embeddings):
        # cosine similarity
        score = sum(a*b for a,b in zip(query_embedding, emb))

        if score > best_score:
            best_score = score
            best_sentence = sentence

    return best_sentence.strip()