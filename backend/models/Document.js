const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  docId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  storagePath: { type: String },
  status: { type: String, enum: ['processing', 'ready', 'error'], default: 'processing' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', DocumentSchema);
