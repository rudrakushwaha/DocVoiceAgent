import React, {useState, useRef, useEffect} from 'react';
import './dashboard.css';
import ProvenanceViewer from './ProvenanceViewer';
import EmotionIndicator from './EmotionIndicator';

export default function ChatWindow({messages, onSend, aiTyping, onStartVoice, voiceOutput, setVoiceOutput}){
  const bodyRef = useRef();
  useEffect(()=>{ if(bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight },[messages, aiTyping]);

  return (
    <div className="chat-card">
      <div style={{padding:16,borderBottom:'1px solid rgba(15,23,42,0.04)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:800}}>Conversation</div>
          <div style={{fontSize:13,color:'var(--muted)'}}>AI Assistant</div>
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.map((m,idx)=> (
          <div key={idx} style={{display:'flex',flexDirection:'column',gap:6,alignItems: m.role==='user' ? 'flex-end':'flex-start'}}>
            <div className={`message ${m.role==='user' ? 'user':'ai'}`}>
              <div style={{whiteSpace:'pre-wrap'}}>{m.text}</div>
              <div className="meta">
                {m.role==='ai' && <EmotionIndicator emotion={m.emotion} />}
                <div style={{marginLeft:8}}>
                  {m.role==='ai' && <details><summary style={{cursor:'pointer',color:'var(--muted)',fontSize:12}}>Show Sources</summary><ProvenanceViewer sources={m.sources}/></details>}
                </div>
              </div>
            </div>
          </div>
        ))}

        {aiTyping && (
          <div style={{display:'flex',alignItems:'center'}}>
            <div className="message ai" style={{maxWidth:220}}>
              <div className="typing"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
            </div>
          </div>
        )}
      </div>

      <div style={{borderTop:'1px solid rgba(15,23,42,0.04)'}}>
        {/* MessageInput will be placed by parent so actions remain centralised */}
      </div>
    </div>
  )
}
