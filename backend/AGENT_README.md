# DocAI Agent Layer

## Overview

The agent layer adds intelligent action capabilities to the existing DocAI RAG system. It can detect user intent from natural language queries and execute specific actions.

## Architecture

```
backend/
├── agentController.js          # Main agent controller with intent detection
├── actionHandlers/
│   ├── email.js               # Email sending via n8n webhook
│   ├── pdf.js                 # PDF generation using PDFKit
│   └── scheduler.js           # Event scheduling via n8n webhook
└── server.js                  # Updated with agent routes
```

## Supported Actions

### 1. Send Email
- **Triggers**: "send email", "mail", "send to john@gmail.com"
- **Handler**: Calls n8n webhook
- **Environment**: `N8N_EMAIL_WEBHOOK_URL`

### 2. Generate PDF
- **Triggers**: "pdf", "export", "download", "save as file"
- **Handler**: Creates PDF using PDFKit
- **Output**: Stored in `/uploads` directory

### 3. Schedule Event
- **Triggers**: "remind", "schedule", "meeting", "tomorrow at 5pm"
- **Handler**: Calls n8n webhook
- **Environment**: `N8N_SCHEDULER_WEBHOOK_URL`

## API Endpoints

### POST /api/agent/execute
**Request:**
```json
{
  "userId": "user123",
  "query": "send this summary to john@gmail.com",
  "ragResponse": "Document summary content..."
}
```

**Response:**
```json
{
  "action": "send_email",
  "status": "success",
  "message": "Email sent successfully to john@gmail.com",
  "data": {
    "email": "john@gmail.com",
    "subject": "Document Summary",
    "webhookStatus": 200
  }
}
```

### GET /api/agent/health
Health check endpoint for the agent service.

### GET /api/downloads/:filename
Download generated PDF files.

## Environment Variables

Add these to your `.env` file:

```bash
# n8n Webhook URLs (optional - will simulate if not set)
N8N_EMAIL_WEBHOOK_URL=https://your-n8n-instance.com/webhook/email
N8N_SCHEDULER_WEBHOOK_URL=https://your-n8n-instance.com/webhook/scheduler

# Existing variables (unchanged)
OPENAI_API_KEY=your_openai_key
PYTHON_RAG_URL=http://localhost:8000/query-rag
# ... other existing variables
```

## Intent Detection

The agent uses rule-based pattern matching for intent detection:

### Email Patterns
- Contains "send" + "email"
- Contains "mail"
- Contains "send" + email address (@)

### PDF Patterns
- Contains "pdf", "export", "download"
- Contains "save" + "file" or "document"

### Schedule Patterns
- Contains "remind", "schedule", "meeting", "appointment"
- Contains time indicators: "tomorrow", "today", "time"

## Error Handling

- Missing parameters return 400
- Service timeouts return 500 with descriptive message
- n8n webhook errors are logged and propagated
- PDF generation errors are caught and logged

## Development Notes

- Without n8n webhook URLs, actions will simulate and return success
- PDF files are stored in `/uploads` directory
- All actions include comprehensive logging
- Time parsing supports various formats (9am, 9:00 PM, etc.)

## Testing

Test the agent with these example queries:

```bash
# Email
curl -X POST http://localhost:4000/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","query":"send this summary to test@example.com","ragResponse":"Test content"}'

# PDF
curl -X POST http://localhost:4000/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","query":"export this as pdf","ragResponse":"Test content"}'

# Schedule
curl -X POST http://localhost:4000/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","query":"remind me tomorrow at 5pm","ragResponse":"Test content"}'
```

## Integration

The agent layer is designed to work alongside your existing RAG pipeline without any modifications. Simply call the agent endpoint after getting your RAG response to add action capabilities.
