import React from 'react';
import './PDFDownloadModal.css';

const PDFDownloadModal = ({ isOpen, onClose, pdfUrl, filename }) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>📄 PDF Generated Successfully</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p>Your PDF "<strong>{filename}</strong>" is ready for download.</p>
          <div className="download-section">
            <button className="download-btn" onClick={handleDownload}>
              📥 Download PDF
            </button>
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="preview-link"
            >
              🔍 Open in New Tab
            </a>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default PDFDownloadModal;
