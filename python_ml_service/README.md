DocVoice-Agent ML Microservice

Quick start:

- Create a Python 3.10+ virtualenv and install requirements:
  python -m venv .venv
  .venv\Scripts\pip install -r requirements.txt
- Set env vars: `OPENAI_API_KEY`, optional `PYTHON_FAISS_DIR`, `PORT`.
- Run:
  uvicorn main:app --host 0.0.0.0 --port 8000

Endpoints:
- POST /process-document
- POST /delete-document
- POST /voice-to-text-emotion
- POST /query-rag

Notes:
- This service uses FAISS indexes stored under `indexes/{userId}` and a small metadata file.
- For production, replace file-based metadata with a durable DB and add authentication.
