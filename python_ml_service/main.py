import os
import io
import shutil
import tempfile
from typing import List

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.document_processor import process_document
from services.faiss_index import delete_document_vectors, search_user_index
from services.whisper_ser import transcribe_and_emotion
from services.langchain_rag import query_rag

app = FastAPI(title='DocVoice-Agent ML Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    docId: str
    userId: str
    fileUrl: str


class DeleteRequest(BaseModel):
    docId: str
    userId: str


class QueryRequest(BaseModel):
    userId: str
    query: str
    emotion: str = 'neutral'


@app.post('/process-document')
async def api_process_document(req: ProcessRequest):
    try:
        chunks = await process_document(req.docId, req.userId, req.fileUrl)
        return { 'chunks': chunks }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/delete-document')
async def api_delete_document(req: DeleteRequest):
    try:
        await delete_document_vectors(req.userId, req.docId)
        return { 'ok': True }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/voice-to-text-emotion')
async def api_voice_to_text_emotion(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        result = await transcribe_and_emotion(audio_bytes)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/query-rag')
async def api_query_rag(req: QueryRequest):
    try:
        ans = await query_rag(req.userId, req.query, req.emotion)
        return ans
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run('main:app', host='0.0.0.0', port=port, reload=True)
