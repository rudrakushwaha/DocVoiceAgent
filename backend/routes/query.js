const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Session = require("../models/Session");

router.use(auth);

// POST /api/query/ask
router.post("/ask", async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: "unauthorized" });

  const { message, sessionId } = req.body || {};
  if (!message || typeof message !== "string")
    return res.status(400).json({ error: "message required" });
  const emotion = req.body.emotion || "neutral";

  let session;
  let newSessionId = sessionId;
  console.log('[QUERY] ===== SESSION DEBUG =====');
  console.log('[QUERY] Incoming sessionId:', sessionId);
  console.log('[QUERY] UserId:', uid);
  try {
    // 1. Session Reuse Logic
    if (sessionId) {
      console.log('[QUERY] Looking for existing session:', { sessionId, userId: uid });
      session = await Session.findOne({ sessionId, userId: uid });
      console.log('[QUERY] Session lookup result:', session ? 'Found' : 'Not found');
      if (session) {
        console.log('[QUERY] Existing session message count:', session.messages.length);
      }
    }
    if (!session) {
      // Only create a new session if sessionId is missing or not found
      newSessionId = uuidv4();
      session = new Session({
        sessionId: newSessionId,
        userId: uid,
        messages: [],
      });
      await session.save();
      console.log('[QUERY] New session created and saved');
    } else {
      console.log('[QUERY] Reusing existing session:', session.sessionId);
    }

    // 2. Store user message
    session.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });
    if (session.messages.length > 32)
      session.messages = session.messages.slice(-32);
    await session.save();
    console.log('[QUERY] User message saved. Total messages:', session.messages.length);

    // 3. Prepare last 8 messages for context window (moved before email/schedule checks)
    const history = session.messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

    // 4. Check if this is an email, schedule, or PDF export request
    const isEmailRequest = /email|mail|send|send.*mail|mail.*send/i.test(message) && !/pdf|export|download|attachment/i.test(message);
    const isScheduleRequest = /schedule|remind|reminder|meeting|appointment|calendar|set.*reminder|create.*event/i.test(message);
    const isPDFExportRequest = /pdf|export|download|attachment/i.test(message);
    
    console.log('[QUERY] Request detection:', {
      isEmailRequest,
      isScheduleRequest,
      isPDFExportRequest,
      message: message.substring(0, 50)
    });
    
    // Handle PDF export requests first (priority over email)
    if (isPDFExportRequest) {
      console.log('[QUERY] PDF export request detected, generating downloadable PDF');
      
      try {
        // Call PDF generation endpoint directly
        const pdfUrl = process.env.PDF_GENERATE_URL || 'http://localhost:4000/api/pdf/generate';
        const pdfResponse = await axios.post(pdfUrl, {
          type: 'chat',
          sessionId: session.sessionId,
          title: 'Chat History Export'
        }, { 
          timeout: 1000 * 60,
          headers: {
            'Authorization': req.headers.authorization || '',
            'Content-Type': 'application/json'
          }
        });
        
        const pdfData = pdfResponse.data;
        console.log('[QUERY] PDF generated successfully:', pdfData);
        
        // Store assistant message
        const exportAnswer = `✅ PDF generated successfully! 

📄 **Filename:** ${pdfData.filename}
📋 **Size:** ${Math.round(pdfData.size / 1024)} KB
📝 **Type:** Chat History PDF

🔗 **Download Link:** http://localhost:4000/api/pdf-download/${pdfData.filename}

🎯 **For Popup:** Open this link in new tab: http://localhost:4000/pdf-popup.html?filename=${encodeURIComponent(pdfData.filename)}&size=${Math.round(pdfData.size / 1024)}&downloadUrl=${encodeURIComponent('http://localhost:4000/api/pdf-download/' + pdfData.filename)}

Your complete chat history has been exported and is ready for download!`;

        session.messages.push({ role: 'assistant', content: exportAnswer, timestamp: new Date() });
        if (session.messages.length > 32) session.messages = session.messages.slice(-32);
        await session.save();
        
        return res.json({
          answer: exportAnswer,
          sources: [],
          emotion,
          confidence: null,
          pdfData: pdfData,
          sessionId: session.sessionId,
          action: 'pdf_generated'
        });
        
      } catch (pdfError) {
        console.error('[QUERY] PDF generation error:', pdfError.message);
        const fallbackAnswer = 'I apologize, but I was unable to generate the PDF. Please try again.';
        
        session.messages.push({ role: 'assistant', content: fallbackAnswer, timestamp: new Date() });
        if (session.messages.length > 32) session.messages = session.messages.slice(-32);
        await session.save();
        
        return res.json({
          answer: fallbackAnswer,
          sources: [],
          emotion,
          confidence: null,
          sessionId: session.sessionId,
          action: 'pdf_failed'
        });
      }
    }
    
    if (isEmailRequest) {
      console.log('[QUERY] Email request detected, routing to agent');
      
      // Try to get email from Firebase user token
      let userEmail = uid; // fallback to userId
      
      // Check if user object has email (from Firebase auth)
      if (req.user && req.user.email) {
        userEmail = req.user.email;
        console.log('[QUERY] Using email from Firebase token:', userEmail);
      } else {
        console.log('[QUERY] No email in token, using userId as fallback');
      }
      
      // Also try to extract email from the message (if user mentioned it)
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/i);
      if (emailMatch) {
        userEmail = emailMatch[0];
        console.log('[QUERY] Email extracted from message:', userEmail);
      }
      
      try {
        // Route to agent for email processing
        const agentUrl = process.env.AGENT_URL || 'http://localhost:4000/api/agent/execute';
        const agentResponse = await axios.post(agentUrl, {
          action: 'email',
          userId: uid,
          query: message,
          emotion: emotion || 'neutral',
          history: history,
          sessionId: session.sessionId,
          email: userEmail // Pass the actual email address
        }, { timeout: 1000 * 60 });
        
        const agentData = agentResponse.data || {};
        console.log('[QUERY] Agent email response:', agentData);
        
        // Store assistant message
        const emailAnswer = agentData.answer || 'Email processing completed.';
        session.messages.push({ role: 'assistant', content: emailAnswer, timestamp: new Date() });
        if (session.messages.length > 32) session.messages = session.messages.slice(-32);
        await session.save();
        
        return res.json({
          answer: emailAnswer,
          sources: agentData.sources || [],
          emotion,
          confidence: agentData.confidence || null,
          emailData: agentData.emailData,
          sessionId: session.sessionId,
          action: 'email',
          userEmail: userEmail
        });
        
      } catch (agentError) {
        console.error('[QUERY] Agent email error:', agentError.message);
        const fallbackAnswer = `I apologize, but I was unable to send the email to ${userEmail}. Please try again or check your email configuration.`;
        
        session.messages.push({ role: 'assistant', content: fallbackAnswer, timestamp: new Date() });
        if (session.messages.length > 32) session.messages = session.messages.slice(-32);
        await session.save();
        
        return res.json({
          answer: fallbackAnswer,
          sources: [],
          emotion,
          confidence: null,
          error: 'Email service unavailable',
          sessionId: session.sessionId,
          action: 'email_failed',
          userEmail: userEmail
        });
      }
    }
    
    if (isScheduleRequest) {
      console.log('[QUERY] Schedule request detected, routing to agent');
      
      try {
        // Route to agent for schedule processing
        const agentUrl = process.env.AGENT_URL || 'http://localhost:4000/api/agent/execute';
        const agentResponse = await axios.post(agentUrl, {
          action: 'schedule',
          userId: uid,
          query: message,
          emotion: emotion || 'neutral',
          history: history,
          sessionId: session.sessionId
        }, { timeout: 1000 * 60 });
        
        const agentData = agentResponse.data || {};
        console.log('[QUERY] Agent schedule response:', agentData);
        
        // Store assistant message
        const scheduleAnswer = agentData.answer || 'Event scheduled successfully.';
        session.messages.push({ role: 'assistant', content: scheduleAnswer, timestamp: new Date() });
        if (session.messages.length > 32) session.messages = session.messages.slice(-32);
        await session.save();
        
        return res.json({
          answer: scheduleAnswer,
          sources: agentData.sources || [],
          emotion,
          confidence: agentData.confidence || null,
          scheduleData: agentData.scheduleData,
          sessionId: session.sessionId,
          action: 'schedule'
        });
        
      } catch (agentError) {
        console.error('[QUERY] Agent schedule error:', agentError.message);
        const fallbackAnswer = 'I apologize, but I was unable to schedule the event. Please try again or check your scheduler configuration.';
        
        session.messages.push({ role: 'assistant', content: fallbackAnswer, timestamp: new Date() });
        if (session.messages.length > 32) session.messages = session.messages.slice(-32);
        await session.save();
        
        return res.json({
          answer: fallbackAnswer,
          sources: [],
          emotion,
          confidence: null,
          error: 'Scheduler service unavailable',
          sessionId: session.sessionId,
          action: 'schedule_failed'
        });
      }
    }

    // 5. Call Python RAG with history
    const pythonUrl = process.env.PYTHON_RAG_URL || 'http://localhost:8000/query-rag';
    const resp = await axios.post(pythonUrl, { userId: uid, query: message, emotion, history }, { timeout: 1000 * 60 });
    // 3. Prepare last 8 messages for context window
    const history = session.messages
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    // 4. Call Python RAG with history
    const pythonUrl =
      process.env.PYTHON_RAG_URL || "http://localhost:8000/query-rag";
    const resp = await axios.post(
      pythonUrl,
      { userId: uid, query: message, emotion, history },
      { timeout: 1000 * 60 },
    );
    const data = resp && resp.data ? resp.data : {};
    const answer = data.answer || "";
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const confidence =
      typeof data.confidence === "number" ? data.confidence : null;

    // 5. Store assistant message
    session.messages.push({
      role: "assistant",
      content: answer,
      timestamp: new Date(),
    });
    if (session.messages.length > 32)
      session.messages = session.messages.slice(-32);
    await session.save();
    console.log('[QUERY] Assistant message saved. Total messages:', session.messages.length);
    console.log('[QUERY] Returning sessionId in response:', session.sessionId);

    return res.json({
      answer,
      sources,
      emotion,
      confidence,
      sessionId: session.sessionId,
    });
  } catch (err) {
    console.error(
      "query.ask error for user",
      uid,
      err && err.message ? err.message : err,
    );
    const status =
      err && err.response && err.response.status ? err.response.status : 500;
    const messageErr =
      err && err.response && err.response.data
        ? err.response.data
        : "failed_to_query_rag";
    return res.status(status).json({ error: messageErr });
  }
});

// POST /api/query/text-emotion
router.post("/text-emotion", async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: "unauthorized" });

  const { query } = req.body || {};
  if (!query || typeof query !== "string")
    return res.status(400).json({ error: "query required" });

  try {
    const pythonUrl =
      process.env.PYTHON_TEXT_EMOTION_URL ||
      "http://localhost:8000/text-emotion";

    console.log(`[text-emotion] Calling Python service: ${pythonUrl}`);
    console.log(`[text-emotion] Query: "${query.substring(0, 50)}..."`);

    const resp = await axios.post(
      pythonUrl,
      { userId: uid, query },
      { timeout: 10000 },
    );
    const data = resp && resp.data ? resp.data : {};

    console.log(
      `[text-emotion] Python response: emotion=${data.emotion}, confidence=${data.confidence}`,
    );

    return res.json({
      emotion: data.emotion || "neutral",
      confidence: data.confidence || 0,
      raw_label: data.raw_label || "",
      all_scores: data.all_scores || {},
    });
  } catch (err) {
    console.error(
      `[text-emotion] Error for user ${uid}:`,
      err && err.message ? err.message : err,
    );
    if (err.code === "ECONNREFUSED") {
      console.error(
        "[text-emotion] CRITICAL: Cannot connect to Python service at port 8000. Is it running?",
      );
    }
    if (err.code === "ETIMEDOUT") {
      console.error(
        "[text-emotion] CRITICAL: Python service timeout. Response took too long.",
      );
    }
    const status =
      err && err.response && err.response.status ? err.response.status : 500;
    const messageErr =
      err && err.response && err.response.data
        ? err.response.data
        : `Python service error: ${err.message || "unknown"}`;
    return res.status(status).json({ error: messageErr });
  }
});

// POST /api/query/voice
const multer = require("multer");
const upload = multer();

router.post("/voice", upload.single("file"), async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: "unauthorized" });

  if (!req.file || !req.file.buffer)
    return res.status(400).json({ error: "audio file required" });

  try {
    // Send audio buffer to Python ML service
    const pythonUrl =
      process.env.PYTHON_VOICE_URL ||
      "http://localhost:8000/voice-to-text-emotion";
    const formData = {
      file: {
        value: req.file.buffer,
        options: {
          filename: req.file.originalname || "voice-query.webm",
          contentType: req.file.mimetype || "audio/webm",
        },
      },
    };
    // Use axios for multipart upload
    const axiosFormData = require("form-data");
    const form = new axiosFormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "voice-query.webm",
      contentType: req.file.mimetype || "audio/webm",
    });
    const resp = await axios.post(pythonUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const data = resp && resp.data ? resp.data : {};
    // Get transcribed text from Python service
    const transcribedText = data.text || "";
    let answer = transcribedText;
    let emotion = data.emotion || "neutral";
    let sources = [];
    // If you want to run RAG, call Python RAG endpoint here
    if (transcribedText) {
      try {
        const ragUrl =
          process.env.PYTHON_RAG_URL || "http://localhost:8000/query-rag";
        const ragResp = await axios.post(ragUrl, {
          userId: uid,
          query: transcribedText,
          emotion,
        });
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
    console.error(
      "query.voice error for user",
      uid,
      err && err.message ? err.message : err,
    );
    const status =
      err && err.response && err.response.status ? err.response.status : 500;
    const messageErr =
      err && err.response && err.response.data
        ? err.response.data
        : "failed_to_voice_query";
    return res.status(status).json({ error: messageErr });
  }
});

// GET /api/session/:sessionId
router.get("/session/:sessionId", async (req, res) => {
  const uid = req.user && req.user.uid;

  if (!uid) return res.status(401).json({ error: "unauthorized" });
  const { sessionId } = req.params;

  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    const session = await Session.findOne({ sessionId, userId: uid });
    if (!session) return res.status(404).json({ error: "session_not_found" });
    return res.json({ sessionId, messages: session.messages });
  } catch (err) {
    console.error("fetch session error", err);
    return res.status(500).json({ error: "failed_to_fetch_session" });
  }
});

module.exports = router;
