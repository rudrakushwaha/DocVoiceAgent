const admin = require('../services/firebaseAdmin');

async function authMiddleware(req, res, next){
  const authHeader = req.get('Authorization') || req.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = { uid: decoded.uid, email: decoded.email, firebase: decoded };
    next();
  } catch (err) {
    console.error('Token verification failed', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = authMiddleware;
