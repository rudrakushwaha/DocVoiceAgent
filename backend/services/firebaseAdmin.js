const admin = require('firebase-admin');
const fs = require('fs');

function initFirebaseAdmin(){
  if (admin.apps && admin.apps.length) return admin;

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let creds = null;
  if (jsonEnv) {
    try { creds = JSON.parse(jsonEnv); } catch(e){ console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON', e); }
  } else if (base64) {
    try { creds = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')); } catch(e){ console.error('Invalid FIREBASE_SERVICE_ACCOUNT_BASE64', e); }
  } else if (path) {
    try { creds = JSON.parse(fs.readFileSync(path, 'utf8')); } catch(e){ console.error('Unable to read FIREBASE_SERVICE_ACCOUNT_PATH', e); }
  }

  if (!creds) {
    console.warn('Firebase admin not initialized - missing service account credentials');
    return admin;
  }

  admin.initializeApp({
    credential: admin.credential.cert(creds),
    databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
  });

  console.log('Firebase admin initialized');
  return admin;
}

module.exports = initFirebaseAdmin();
