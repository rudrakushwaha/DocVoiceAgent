const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const { uploadUserFile } = require('../services/firebaseStorage');
const admin = require('../services/firebaseAdmin');
const Document = require('../models/Document');
const Chunk = require('../models/Chunk');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { /* ignore */ }

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});

const upload = multer({ storage });

router.use(auth);

// Accept multipart/form-data with a `file` field and optional `title`
router.post('/upload', upload.single('file'), async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  if (!req.file) return res.status(400).json({ error: 'file required' });

  const originalName = req.file.originalname;
  console.log('documents.upload - userId:', uid, 'filename:', originalName);

  const localPath = req.file.path;
  let docRecord = null;

  try {
    const buffer = fs.readFileSync(localPath);

    // Upload to Firebase Storage (returns docId and fileUrl)
    const { docId, fileUrl, storagePath } = await uploadUserFile(uid, buffer, originalName);

    // create Document record with status processing
    docRecord = new Document({ docId, userId: uid, fileName: originalName, fileUrl, storagePath, status: 'processing' });
    await docRecord.save();

    // notify Python ML service to process document
    const pythonUrl = process.env.PYTHON_PROCESS_URL || 'http://localhost:8000/process-document';
    const resp = await axios.post(pythonUrl, { docId, userId: uid, fileUrl }, { timeout: 1000 * 60 * 5 });

    const chunks = (resp && resp.data && resp.data.chunks) || [];
    if (Array.isArray(chunks) && chunks.length) {
      const toInsert = chunks.map((c, idx) => ({
        chunkId: c.chunkId || `${docId}-${idx}-${Date.now()}`,
        docId,
        userId: uid,
        text: c.text || '',
        faissIndex: c.faissIndex || (c.index ? String(c.index) : undefined),
        order: typeof c.order === 'number' ? c.order : idx
      }));
      await Chunk.insertMany(toInsert);
    }

    // mark document ready
    docRecord.status = 'ready';
    await docRecord.save();

    res.json({ success: true, docId, fileName: originalName });
  } catch (err) {
    console.error('documents.upload error', err);
    if (docRecord) {
      try { docRecord.status = 'error'; await docRecord.save(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: 'upload_failed' });
  } finally {
    // remove local temp file
    try { fs.unlinkSync(localPath); } catch (e) { /* ignore */ }
  }
});

// Return all documents for the user
router.get('/list', async (req, res) => {
  const uid = req.user && req.user.uid;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  try {
    const docs = await Document.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, documents: docs });
  } catch (err) {
    console.error('documents.list error', err);
    res.status(500).json({ error: 'failed_to_list_documents' });
  }
});

// Delete document, chunks, storage object, and notify Python to delete vectors
router.delete('/:docId', async (req, res) => {
  const uid = req.user && req.user.uid;
  const docId = req.params.docId;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  try {
    const doc = await Document.findOne({ docId, userId: uid });
    if (!doc) return res.status(404).json({ error: 'not_found' });

    // delete chunks
    await Chunk.deleteMany({ docId });

    // delete document record
    await Document.deleteOne({ docId });

    // delete storage file if present
    if (doc.storagePath && admin && admin.storage) {
      try {
        const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET || undefined);
        await bucket.file(doc.storagePath).delete();
      } catch (e) {
        console.warn('failed to delete storage object', e.message || e);
      }
    }

    // notify Python to delete FAISS vectors
    try {
      const pythonDeleteUrl = process.env.PYTHON_DELETE_URL || 'http://localhost:8000/delete-document';
      await axios.post(pythonDeleteUrl, { docId, userId: uid });
    } catch (e) {
      console.warn('failed to notify python delete', e.message || e);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('documents.delete error', err);
    res.status(500).json({ error: 'failed_to_delete' });
  }
});

module.exports = router;
