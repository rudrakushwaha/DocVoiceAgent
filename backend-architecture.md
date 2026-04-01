# DocVoice Agent - Backend Architecture Overview

## 🏗️ System Architecture

The DocVoice Agent backend is a **microservices-based architecture** consisting of two main components:

1. **Node.js API Gateway** (Port 4000) - Main backend service
2. **Python ML Service** (Port 8000) - Machine Learning and AI processing

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Node.js API    │    │  Python ML      │
│   (React)       │◄──►│   Gateway       │◄──►│  Service        │
│   Port: 3000    │    │   Port: 4000    │    │   Port: 8000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Firebase      │
                       │   (Auth +       │
                       │   Storage)      │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   MongoDB       │
                       │   (Database)    │
                       └─────────────────┘
```

## 🔧 Technology Stack

### Node.js Backend
- **Framework**: Express.js
- **Authentication**: Firebase Admin SDK
- **Database**: MongoDB with Mongoose ODM
- **File Storage**: Firebase Storage
- **Document Processing**: Multer for file uploads
- **PDF Generation**: PDFKit
- **HTTP Client**: Axios for service communication

### Python ML Service
- **Framework**: FastAPI
- **ML/AI**: 
  - OpenAI GPT for RAG (Retrieval-Augmented Generation)
  - Whisper for speech-to-text
  - Sentence Transformers for embeddings
  - FAISS for vector similarity search
- **Document Processing**: 
  - PDFMiner for PDF extraction
  - python-docx for Word documents
- **Emotion Analysis**: Custom emotion detection models

## 📊 Data Models

### Document Model
```javascript
{
  docId: String,        // Unique document identifier
  userId: String,       // User who owns the document
  fileName: String,     // Original filename
  fileUrl: String,      // Firebase Storage URL
  storagePath: String,  // Internal storage path
  status: String,       // 'processing' | 'ready' | 'error'
  createdAt: Date
}
```

### Chunk Model
```javascript
{
  chunkId: String,      // Unique chunk identifier
  docId: String,        // Parent document ID
  docName: String,      // Document name for reference
  pageNumber: Number,   // Page number in source document
  userId: String,       // User who owns the chunk
  text: String,         // Actual text content
  faissIndex: String,   // FAISS vector index reference
  order: Number         // Order in document
}
```

### Session Model
```javascript
{
  sessionId: String,    // Unique session identifier
  userId: String,       // User who owns the session
  messages: [{
    role: String,       // 'user' | 'assistant'
    content: String,    // Message content
    emotion: String,    // Detected emotion
    sources: Array,     // Source documents for AI responses
    timestamp: Date
  }],
  createdAt: Date
}
```

## 🚀 API Endpoints

### Authentication & Security
- **Middleware**: Firebase ID token verification
- **All endpoints** require valid Firebase authentication
- **User context** extracted from JWT tokens

### Document Management (`/api/documents`)

#### POST `/api/documents/upload`
- **Purpose**: Upload and process documents
- **Flow**:
  1. Receive multipart file upload
  2. Store temporarily on server
  3. Upload to Firebase Storage
  4. Create Document record with 'processing' status
  5. Notify Python ML service for processing
  6. Store processed chunks in MongoDB
  7. Update document status to 'ready'

#### GET `/api/documents/list`
- **Purpose**: List all user documents
- **Returns**: Array of documents with metadata

#### DELETE `/api/documents/:docId`
- **Purpose**: Delete document and all associated data
- **Flow**:
  1. Delete chunks from MongoDB
  2. Delete document record
  3. Delete file from Firebase Storage
  4. Notify Python service to delete vectors

### Query & RAG (`/api/query`)

#### POST `/api/query/ask`
- **Purpose**: Main query endpoint with intelligent routing
- **Features**:
  - **Session Management**: Creates/reuses chat sessions
  - **Smart Routing**: Detects email, schedule, and PDF export requests
  - **RAG Processing**: Routes to Python ML service for document Q&A
  - **Context Window**: Maintains last 32 messages for context

**Request Flow**:
```
User Query → Intent Detection → Route to appropriate handler:
├── Email Request → Agent Service → Email Handler
├── Schedule Request → Agent Service → Scheduler
├── PDF Export → PDF Generator
└── Document Query → Python ML RAG
```

#### POST `/api/query/text-emotion`
- **Purpose**: Detect emotion in text queries
- **Used by**: Frontend for emotion-aware responses

#### POST `/api/query/voice`
- **Purpose**: Process voice queries
- **Flow**:
  1. Receive audio file
  2. Send to Python Whisper service
  3. Get transcription and emotion
  4. Optionally run RAG on transcribed text

#### GET `/api/query/session/:sessionId`
- **Purpose**: Retrieve chat session history

### Agent Service (`/api/agent`)

#### POST `/api/agent/execute`
- **Purpose**: Execute specialized actions
- **Actions**:
  - `question`: Document Q&A with RAG
  - `summarize`: Document summarization
  - `email`: Generate and send emails with document content
  - `schedule`: Create calendar events and reminders

#### GET `/api/agent/actions`
- **Purpose**: List available agent actions

### PDF Services (`/api/pdf`, `/api/pdf-download`)

#### POST `/api/pdf/generate`
- **Purpose**: Generate PDF from chat history
- **Features**: Custom formatting, metadata inclusion

#### GET `/api/pdf-download/:filename`
- **Purpose**: Serve generated PDF files

## 🤖 Machine Learning Pipeline

### Document Processing Flow
```
Document Upload → Text Extraction → Chunking → Embedding Generation → FAISS Indexing → Storage
```

1. **Text Extraction**: 
   - PDF: PDFMiner.six
   - Word: python-docx
   - Future: Excel, PowerPoint support

2. **Chunking Strategy**:
   - Intelligent text segmentation
   - Page-level preservation
   - Metadata preservation

3. **Embedding Generation**:
   - Model: Sentence Transformers
   - Vector dimension: 384
   - Semantic similarity preservation

4. **Vector Storage**:
   - FAISS CPU index for similarity search
   - User-separated indexes for data isolation

### RAG (Retrieval-Augmented Generation)
```
User Query → Embedding → Similarity Search → Context Retrieval → GPT Prompt Generation → Response
```

**Components**:
- **Query Embedding**: Convert user query to vector
- **Similarity Search**: Find relevant document chunks
- **Context Building**: Assemble retrieved chunks as context
- **Prompt Engineering**: Construct prompt with context + query
- **GPT Integration**: OpenAI API for response generation

### Voice Processing
```
Audio Input → Whisper Transcription → Emotion Detection → Text Processing → Response
```

## 🔐 Security Architecture

### Authentication
- **Firebase Auth**: Primary authentication provider
- **JWT Tokens**: ID token verification
- **User Context**: Extracted from verified tokens

### Data Isolation
- **User Separation**: All data queries filtered by userId
- **Document Access**: Multi-level ownership verification
- **Session Isolation**: Sessions scoped to individual users

### File Security
- **Signed URLs**: Firebase Storage with time-limited access
- **Temporary Storage**: Local files cleaned after processing
- **Input Validation**: File type and size restrictions

## 📈 Performance & Scalability

### Database Optimization
- **Indexes**: userId, docId, sessionId fields indexed
- **Connection Pooling**: MongoDB connection management
- **Query Optimization**: Efficient aggregation pipelines

### Caching Strategy
- **Session Caching**: In-memory session management
- **Vector Indexing**: FAISS for fast similarity search
- **Static Files**: Express static file serving

### Error Handling
- **Graceful Degradation**: Fallback responses for ML failures
- **Timeout Management**: Configurable timeouts for external services
- **Comprehensive Logging**: Structured error tracking

## 🔧 Configuration & Environment

### Environment Variables
```bash
# Server Configuration
PORT=4000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/docvoice
MONGODB_DB=docvoice

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=...
FIREBASE_STORAGE_BUCKET=your-bucket-name
FIREBASE_DATABASE_URL=...

# External Services
PYTHON_RAG_URL=http://localhost:8000/query-rag
PYTHON_PROCESS_URL=http://localhost:8000/process-document
PYTHON_VOICE_URL=http://localhost:8000/voice-to-text-emotion

# OpenAI
OPENAI_API_KEY=...

# Email (if configured)
EMAIL_SERVICE=...
EMAIL_USER=...
EMAIL_PASS=...
```

## 🚀 Deployment Architecture

### Production Setup
- **Load Balancer**: Nginx/AWS ALB for traffic distribution
- **Process Management**: PM2 for Node.js process management
- **Monitoring**: Health checks and logging
- **Scaling**: Horizontal scaling support

### Service Dependencies
```
Node.js Backend requires:
├── MongoDB (database)
├── Firebase (auth + storage)
├── Python ML Service
└── OpenAI API

Python ML Service requires:
├── FAISS indexes storage
├── Model files (cached locally)
└── OpenAI API
```

## 📊 Monitoring & Observability

### Logging Strategy
- **Structured Logging**: JSON format for easy parsing
- **Request Tracking**: Correlation IDs across services
- **Error Classification**: Error types and severity levels

### Health Checks
- **API Gateway**: `/api/health` endpoint
- **Database Connection**: MongoDB connectivity
- **External Services**: Python service availability

### Performance Metrics
- **Response Times**: API endpoint latency tracking
- **Document Processing**: Upload and processing times
- **ML Performance**: Query response times

## 🔄 Request Flow Examples

### Document Upload Flow
```
1. Frontend → POST /api/documents/upload
2. Node.js: Receive file → Upload to Firebase
3. Node.js: Create Document record (status: processing)
4. Node.js → POST /process-document (Python)
5. Python: Download file → Extract text → Create chunks
6. Python: Generate embeddings → Update FAISS index
7. Python → Return chunks to Node.js
8. Node.js: Store chunks in MongoDB
9. Node.js: Update Document status (ready)
10. Node.js → Response to Frontend
```

### Query Processing Flow
```
1. Frontend → POST /api/query/ask
2. Node.js: Session management
3. Node.js: Intent detection (email/schedule/query)
4. Node.js → POST /query-rag (Python)
5. Python: Query embedding → Similarity search
6. Python: Context building → GPT prompt
7. Python → OpenAI API call
8. Python → Response to Node.js
9. Node.js: Store in session → Response to Frontend
```

## 🎯 Key Features & Capabilities

### Multi-Modal Input
- **Text**: Direct text queries
- **Voice**: Speech-to-text with emotion detection
- **Documents**: PDF, Word processing

### Intelligent Actions
- **Email Generation**: Automated email with document content
- **Scheduling**: Calendar event creation
- **PDF Export**: Chat history and document export

### Context-Aware Responses
- **Session Memory**: Maintains conversation context
- **Document Awareness**: Responses grounded in uploaded documents
- **Emotion Detection**: Emotion-aware interaction

### Security & Privacy
- **User Isolation**: Complete data separation
- **Secure Storage**: Firebase with signed URLs
- **Authentication**: Firebase Auth integration

## 🚀 Future Enhancements

### Scalability
- **Redis Integration**: Caching layer
- **Microservice Split**: Further service decomposition
- **Load Balancing**: Multiple instance support

### Features
- **Real-time Collaboration**: Multi-user document sharing
- **Advanced Analytics**: Usage insights and metrics
- **Integration Hub**: Third-party service integrations

### AI/ML Improvements
- **Custom Models**: Fine-tuned domain-specific models
- **Multilingual Support**: Multiple language processing
- **Advanced RAG**: Hybrid search capabilities

---

## 📞 Contact & Support

For technical questions or support regarding the backend architecture, please refer to:
- **Code Repository**: Backend source code
- **API Documentation**: Interactive API docs
- **Monitoring Dashboard**: Real-time system status

This architecture provides a robust, scalable foundation for the DocVoice Agent platform with strong security, performance, and extensibility characteristics.
