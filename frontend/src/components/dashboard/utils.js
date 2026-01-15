// mock utilities for the dashboard
export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

import { auth } from '../../firebase/firebase';

export async function getAIResponse(message, emotion){
  // Try real backend call with Firebase ID token
  try{
    const user = auth.currentUser;
    if (!user) throw new Error('not_authenticated');
    const token = await user.getIdToken();
    const payload = { message };
    if (emotion) payload.emotion = emotion;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/query/ask';
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(()=>({ error: 'unknown' }));
      throw new Error(err && err.error ? JSON.stringify(err.error) : 'backend_error');
    }

    const data = await resp.json();
    return { text: data.answer || '', emotion: data.emotion || 'neutral', sources: data.sources || [], confidence: data.confidence || null };
  }catch(err){
    console.warn('getAIResponse failed, falling back to mock', err);
    // fallback mock
    await sleep(1200 + Math.random()*800);
    const emotions = ['Neutral','Happy','Frustrated','Surprised'];
    const emotion = emotions[Math.floor(Math.random()*emotions.length)];
    const sources = Array.from({length: Math.ceil(Math.random()*3)}, (_,i)=>`chunk_${Math.floor(Math.random()*1000)}`);
    return {
      text: `AI response to: "${message.slice(0,120)}"\n\n(Generated mock answer)`,
      emotion,
      sources,
      confidence: null
    }
  }
}

// startVoiceRecording now returns { start, stop, isRecording, promise }
export function startVoiceRecording(maxDurationSec = 30) {
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];
  let stopTimeout = null;
  let resolvePromise, rejectPromise;
  let _isRecording = false;
  const promise = new Promise(async (resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return reject(new Error('media_not_supported'));
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return reject(e);
    }
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    mediaRecorder.onerror = (e) => { console.warn('recorder error', e); };
    mediaRecorder.onstop = async () => {
      _isRecording = false;
      const blob = new Blob(chunks, { type: 'audio/webm' });
      try {
        const form = new FormData();
        form.append('file', blob, 'recording.webm');
        const pythonUrl = import.meta.env.VITE_PYTHON_URL || 'http://localhost:8000/voice-to-text-emotion';
        const resp = await fetch(pythonUrl, { method: 'POST', body: form });
        if (!resp.ok) {
          const err = await resp.text().catch(()=>null);
          return rejectPromise(new Error(err || 'transcription_failed'));
        }
        const data = await resp.json();
        resolvePromise(data);
      } catch (err) {
        rejectPromise(err);
      } finally {
        try { stream.getTracks().forEach(t=>t.stop()); } catch(e){}
      }
    };
  });
  return {
    start: () => {
      if (mediaRecorder && !_isRecording) {
        _isRecording = true;
        mediaRecorder.start();
        stopTimeout = setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        }, maxDurationSec * 1000);
      }
    },
    stop: () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        clearTimeout(stopTimeout);
        mediaRecorder.stop();
        _isRecording = false;
      }
    },
    get isRecording() { return _isRecording; },
    promise
  };
}

export function handleSpeak(text){
  // placeholder: integrate Web Speech API or TTS provider
  console.log('handleSpeak() placeholder - would speak:', text);
}
