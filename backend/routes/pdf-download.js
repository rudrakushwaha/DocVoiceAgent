const express = require('express');
const router = express.Router();
// Removed auth middleware for direct browser access
// const auth = require('../middleware/authMiddleware');
const { getPDF } = require('../actionHandlers/pdf');

// router.use(auth); // Commented out for direct access

// GET /api/pdf-download/:filename - Auto-download PDF (public)
router.get('/:filename', async (req, res) => {
  const { filename } = req.params;
  
  try {
    console.log('[PDF-DOWNLOAD] Auto-download request:', { filename });
    
    // Get the PDF file
    const pdfPath = await getPDF(filename);
    
    // Set headers for automatic download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    // Send the PDF file directly
    const fs = require('fs');
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    
    console.log('[PDF-DOWNLOAD] PDF sent for auto-download:', filename);
    
  } catch (error) {
    console.error('[PDF-DOWNLOAD] Error:', error);
    res.status(404).json({ error: 'PDF file not found', message: error.message });
  }
});

module.exports = router;
