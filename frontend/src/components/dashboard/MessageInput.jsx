import React, {useState} from 'react';
import './dashboard.css';

export default function MessageInput({onSend, onStartVoice, voiceOutput, setVoiceOutput}){
  const [text, setText] = useState('');
  const submit = ()=>{ if(text.trim()==='') return; onSend(text); setText(''); }
  return (
    <div className="input-area">
      <textarea className="textbox" value={text} onChange={(e)=>setText(e.target.value)} placeholder="Ask something about your documents..."/>
      <button className="icon-btn" title="Voice" onClick={onStartVoice}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 1v11" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 11a7 7 0 01-14 0" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <label className="toggle"><input type="checkbox" checked={voiceOutput} onChange={(e)=>setVoiceOutput(e.target.checked)} /> Voice Output</label>
        <button className="send-btn" onClick={submit} title="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2l-7 20 1-7 7-13z" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  )
}
