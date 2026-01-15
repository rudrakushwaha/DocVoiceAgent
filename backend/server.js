const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const firebaseAdmin = require('./services/firebaseAdmin');
// initialize mongo connection
require('./services/mongo');

const documentsRouter = require('./routes/documents');
const queryRouter = require('./routes/query');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/documents', documentsRouter);
app.use('/api/query', queryRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API Gateway listening on ${PORT}`));
