import React, {useRef} from 'react';
import './dashboard.css';

export default function DocumentPanel({documents, onUpload, onDelete, processing}){
  const fileRef = useRef();
  const trigger = ()=> fileRef.current?.click();

  const handleFiles = async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    await onUpload(f);
    e.target.value = null;
  }

  return (
    <div className="left-col">
      <div className="doc-header">
        <h3>My Documents</h3>
        <button className="upload-btn" onClick={trigger}>Upload Document</button>
        <input ref={fileRef} type="file" style={{display:'none'}} onChange={handleFiles} />
      </div>

      {processing && <div className="processing">Processing & generating embeddings…</div>}

      <div className="doc-list">
        {documents.length===0 && <div style={{padding:12,color:'var(--muted)'}}>No documents yet. Upload to get started.</div>}
        {documents.map(doc=> (
          <div key={doc.id} className="doc-item">
            <div className="meta">
              <div className="doc-icon">📄</div>
              <div>
                <div className="doc-name">{doc.name}</div>
                <div style={{fontSize:12,color:'var(--muted)'}}>{doc.size ? `${Math.round(doc.size/1024)} KB` : ''}</div>
              </div>
            </div>
            <div className="doc-actions">
              <button title="Delete" onClick={()=>onDelete(doc.id)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
