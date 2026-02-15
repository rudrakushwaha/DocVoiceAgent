import React from 'react';
import './dashboard.css';

export default function ProvenanceViewer({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="prov">
      <strong>Sources</strong>

      <div style={{ marginTop: 8 }}>
        {sources.map((src, index) => (
          <div key={index} className="source-card">

            <div className="source-title">
              📄 [{src.number}] {src.docName} (Page {src.pageNumber})
            </div>

            <div className="source-snippet">
             <strong>{src.snippet}</strong>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
