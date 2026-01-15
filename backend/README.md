Backend API Gateway

Quick start:

- Copy `.env.example` to `.env` and populate service account credentials.
- From the `backend` folder run `npm install` then `npm run dev`.

Notes:
- This service verifies Firebase ID tokens using the Admin SDK. Provide credentials via `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, or `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Routes:
  - `GET /api/health` health check
  - `POST /api/documents/upload` upload a document (protected)
  - `GET /api/documents/list` list user documents (protected)
  - `DELETE /api/documents/:docId` delete document (protected)
  - `POST /api/query/ask` ask a question (protected)
