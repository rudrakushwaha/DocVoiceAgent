const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/docvoice';

async function connect() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err);
    throw err;
  }
}

connect().catch(() => {});

module.exports = mongoose;
