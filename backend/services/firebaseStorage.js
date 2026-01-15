const admin = require('./firebaseAdmin');
const path = require('path');

async function uploadUserFile(userId, fileBuffer, fileName) {
  if (!admin || !admin.storage) throw new Error('Firebase admin not initialized');

  const docId = Date.now().toString();
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `users/${userId}/documents/${docId}-${safeName}`;

  const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET || undefined);
  const file = bucket.file(storagePath);

  await file.save(fileBuffer, { resumable: false });

  // Create a long-lived signed URL (10 years)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10)
  });

  return { docId, fileUrl: url, storagePath };
}

module.exports = { uploadUserFile };
