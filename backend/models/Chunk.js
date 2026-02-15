const mongoose = require('mongoose');

const ChunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true, unique: true },
  docId: { type: String, required: true, index: true },
  docName: { type: String, required: true },      
  pageNumber: { type: Number, required: true },
  userId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  faissIndex: { type: String },
  order: { type: Number, default: 0 }
});

module.exports = mongoose.model('Chunk', ChunkSchema);
