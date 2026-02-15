const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');

router.use(auth);

// POST /api/query/ask
router.post('/ask', async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  const { message, sessionId } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' });
  const emotion = req.body.emotion || 'neutral';

  let session;
  let newSessionId = sessionId;
  try {
    // 1. Session Reuse Logic
    if (sessionId) {
      session = await Session.findOne({ sessionId, userId: uid });
    }
    if (!session) {
      // Only create a new session if sessionId is missing or not found
      newSessionId = uuidv4();
      session = new Session({ sessionId: newSessionId, userId: uid, messages: [] });
      await session.save();
    }

    // 2. Store user message
    session.messages.push({ role: 'user', content: message, timestamp: new Date() });
    if (session.messages.length > 32) session.messages = session.messages.slice(-32);
    await session.save();

    // 3. Prepare last 8 messages for context window
    const history = session.messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

    // 4. Call Python RAG with history
    const pythonUrl = process.env.PYTHON_RAG_URL || 'http://localhost:8000/query-rag';
    const resp = await axios.post(pythonUrl, { userId: uid, query: message, emotion, history }, { timeout: 1000 * 60 });
    const data = resp && resp.data ? resp.data : {};
    const answer = data.answer || '';
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const confidence = typeof data.confidence === 'number' ? data.confidence : null;

    // 5. Store assistant message
    session.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
    if (session.messages.length > 32) session.messages = session.messages.slice(-32);
    await session.save();

    return res.json({ answer, sources, emotion, confidence, sessionId: session.sessionId });
  } catch (err) {
    console.error('query.ask error for user', uid, err && err.message ? err.message : err);
    const status = err && err.response && err.response.status ? err.response.status : 500;
    const messageErr = err && err.response && err.response.data ? err.response.data : 'failed_to_query_rag';
    return res.status(status).json({ error: messageErr });
  }
});

// POST /api/query/voice
const multer = require('multer');
const upload = multer();

router.post('/voice', upload.single('file'), async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'audio file required' });

  try {
    // Send audio buffer to Python ML service
    const pythonUrl = process.env.PYTHON_VOICE_URL || 'http://localhost:8000/voice-to-text-emotion';
    const formData = {
      file: {
        value: req.file.buffer,
        options: {
          filename: req.file.originalname || 'voice-query.webm',
          contentType: req.file.mimetype || 'audio/webm'
        }
      }
    };
    // Use axios for multipart upload
    const axiosFormData = require('form-data');
    const form = new axiosFormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'voice-query.webm',
      contentType: req.file.mimetype || 'audio/webm'
    });
    const resp = await axios.post(pythonUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    const data = resp && resp.data ? resp.data : {};
    // Get transcribed text from Python service
    const transcribedText = data.text || '';
    let answer = transcribedText;
    let emotion = data.emotion || 'neutral';
    let sources = [];
    // If you want to run RAG, call Python RAG endpoint here
    if (transcribedText) {
      try {
        const ragUrl = process.env.PYTHON_RAG_URL || 'http://localhost:8000/query-rag';
        const ragResp = await axios.post(ragUrl, { userId: uid, query: transcribedText, emotion });
        if (ragResp && ragResp.data) {
          answer = ragResp.data.answer || transcribedText;
          sources = ragResp.data.sources || [];
        }
      } catch (e) {
        // fallback: just use transcribed text
      }
    }
    return res.json({ text: transcribedText, answer, emotion, sources });
  } catch (err) {
    console.error('query.voice error for user', uid, err && err.message ? err.message : err);
    const status = err && err.response && err.response.status ? err.response.status : 500;
    const messageErr = err && err.response && err.response.data ? err.response.data : 'failed_to_voice_query';
    return res.status(status).json({ error: messageErr });
  }
});

// GET /api/session/:sessionId
router.get('/session/:sessionId', async (req, res) => {
  const uid = req.user && req.user.uid;

  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const { sessionId } = req.params;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  try {
    const session = await Session.findOne({ sessionId, userId: uid });
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    return res.json({ sessionId, messages: session.messages });
  } catch (err) {
    console.error('fetch session error', err);
    return res.status(500).json({ error: 'failed_to_fetch_session' });
  }
});

module.exports = router;
