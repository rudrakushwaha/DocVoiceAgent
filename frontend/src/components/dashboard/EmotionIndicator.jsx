import React from 'react';
import './dashboard.css';

const EMOJI = {
  Neutral: '😐',
  Happy: '😊',
  Frustrated: '😠',
  Surprised: '😮'
}

export default function EmotionIndicator({emotion}){
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:18}}>{EMOJI[emotion] || '🧠'}</span>
      <span style={{fontSize:12,color:'var(--muted)'}}>Emotion detected: <strong style={{marginLeft:6}}>{emotion}</strong></span>
    </div>
  )
}
