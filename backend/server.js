const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const firebaseAdmin = require('./services/firebaseAdmin');
// initialize mongo connection
require('./services/mongo');

const documentsRouter = require('./routes/documents');
const queryRouter = require('./routes/query');
<<<<<<< HEAD
=======
const agentRouter = require('./agentController');
const pdfRouter = require('./routes/pdf');
const pdfDownloadRouter = require('./routes/pdf-download');
>>>>>>> 1606054 (agentic feature)

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

<<<<<<< HEAD
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/documents', documentsRouter);
app.use('/api/query', queryRouter);
=======
// Serve static files (uploads directory for PDF attachments)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files (public directory for HTML pages)
app.use(express.static(path.join(__dirname, 'public')));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/documents", documentsRouter);
app.use("/api/query", queryRouter);
app.use("/api/agent", agentRouter);
app.use("/api/pdf", pdfRouter);
app.use("/api/pdf-download", pdfDownloadRouter);

// PDF download route
app.get('/api/downloads/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { getPDF } = require('./actionHandlers/pdf');
    
    const pdfPath = await getPDF(filename);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fs = require('fs');
    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('[DOWNLOAD] Error:', error.message);
    res.status(404).json({ error: 'PDF not found' });
  }
});
>>>>>>> 1606054 (agentic feature)

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API Gateway listening on ${PORT}`));
