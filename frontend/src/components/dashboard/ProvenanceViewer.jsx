import React from 'react';
import './dashboard.css';

export default function ProvenanceViewer({sources}){
  if(!sources || sources.length===0) return null;
  return (
    <div className="prov">
      <strong>Sources</strong>
      <div style={{marginTop:8}}>
        {sources.map(src => (
          <div key={src} className="chunk">{src}</div>
        ))}
      </div>
    </div>
  )
}
