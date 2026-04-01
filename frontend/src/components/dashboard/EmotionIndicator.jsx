import React from 'react';
import './dashboard.css';

const EMOJI = {
  neutral: '😐',
  happy: '😊',
  frustrated: '😠',
  confused: '🤔',
  surprised: '😮',
  sad: '😢',
  angry: '😡',
  panic: '😱'
}

export default function EmotionIndicator({emotion}){
  const normalized = (emotion || '').toString().trim().toLowerCase();
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:18}}>{EMOJI[normalized] || '🧠'}</span>
      <span style={{fontSize:12,color:'var(--muted)'}}>Emotion detected: <strong style={{marginLeft:6}}>{emotion}</strong></span>
    </div>
  )
}
