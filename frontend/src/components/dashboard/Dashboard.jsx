import React, { useState, useEffect, useRef } from 'react';
import './dashboard.css';
import TopBar from './TopBar';
import DocumentPanel from './DocumentPanel';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import { getAIResponse, handleSpeak } from './utils';
import { auth } from '../../firebase/firebase';


export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const base = import.meta.env.VITE_API_URL_BASE || 'http://localhost:4000';
        const url = `${base}/api/documents/list`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('failed_to_fetch_documents');
        const data = await resp.json();
        if (data.success && Array.isArray(data.documents)) {
          setDocuments(data.documents.map(doc => ({
            id: doc.docId || doc._id,
            name: doc.fileName || doc.title,
            size: doc.size || 0
          })));
        }
      } catch (err) {
        console.error('fetchDocuments error', err);
      }
    };
    fetchDocuments();
  }, []);
  const [processing, setProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef();
  const [messages, setMessages] = useState([]);
  const [aiTyping, setAiTyping] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('docvoice_sessionId') || null);

  const uploadDocument = async (file) => {
    setProcessing(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('not_authenticated');
      const token = await user.getIdToken();
      const base = import.meta.env.VITE_API_URL_BASE || 'http://localhost:4000';
      const url = `${base}/api/documents/upload`;
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('title', file.name);
      const resp = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err && err.error ? JSON.stringify(err.error) : 'upload_failed');
      }
      const data = await resp.json();
      const doc = { id: data.docId || Date.now().toString(), name: data.fileName || file.name, size: file.size };
      setDocuments(d => [doc, ...d]);
    } catch (err) {
      console.error('uploadDocument error', err);
      const doc = { id: Date.now().toString(), name: file.name, size: file.size };
      setDocuments(d => [doc, ...d]);
    } finally {
      setProcessing(false);
    }
  }

  const deleteDocument = async (id) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('not_authenticated');
      const token = await user.getIdToken();
      const base = import.meta.env.VITE_API_URL_BASE || 'http://localhost:4000';
      const url = `${base}/api/documents/${id}`;
      const resp = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>null);
        throw new Error(err && err.error ? JSON.stringify(err.error) : 'delete_failed');
      }
      setDocuments(d => d.filter(x => x.id !== id));
    } catch (err) {
      console.error('deleteDocument error', err);
      // Optionally show error to user
    }
  }

  // Store sessionId in localStorage when it changes
  useEffect(() => {
    if (sessionId) localStorage.setItem('docvoice_sessionId', sessionId);
  }, [sessionId]);

  // On initial mount, rehydrate chat from backend if sessionId exists
  useEffect(() => {
    let ignore = false;
    const rehydrateChat = async () => {
      const storedSessionId = localStorage.getItem('docvoice_sessionId');
      console.log('[Rehydrate] sessionId in localStorage:', storedSessionId);
      if (!storedSessionId) {
        console.log('[Rehydrate] No sessionId found in localStorage.');
        return;
      }
      try {
        const user = auth.currentUser;
        if (!user) {
          console.log('[Rehydrate] No authenticated user.');
          return;
        }
        const token = await user.getIdToken();
        const base = import.meta.env.VITE_API_URL_BASE || 'http://localhost:4000';
        const url = `${base}/api/query/session/${storedSessionId}`;
        console.log('[Rehydrate] Fetching session messages from:', url);
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) {
          console.error('[Rehydrate] Failed to fetch session:', resp.status);
          throw new Error('failed_to_fetch_session');
        }
        const data = await resp.json();
        console.log('[Rehydrate] Data received from backend:', data);
        if (!ignore && Array.isArray(data.messages)) {
          const mapped = data.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role === 'assistant' ? 'ai' : 'user', text: m.content }));
          console.log('[Rehydrate] Setting messages:', mapped);
          setMessages(mapped);
        } else {
          console.log('[Rehydrate] No messages array in backend response.');
        }
      } catch (err) {
        if (!ignore) console.error('[Rehydrate] Error:', err);
      }
    };
    rehydrateChat();
    return () => { ignore = true; };
  }, []);

  // New Chat handler
  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('docvoice_sessionId');
  };

  const sendMessage = async (text) => {
    setMessages(m => [...m, { role: 'user', text }]);
    setAiTyping(true);
    try {
      const res = await getAIResponse(text, undefined, sessionId);
      setAiTyping(false);
      setMessages(m => [...m, { role: 'ai', text: res.text, sources: res.sources, emotion: res.emotion }]);
      if (!sessionId && res.sessionId) setSessionId(res.sessionId);
      if (voiceOutput) { handleSpeak(res.text); }
    } catch (err) {
      setAiTyping(false);
      setMessages(m => [...m, { role: 'ai', text: 'Error generating response', sources: [], emotion: 'Neutral' }]);
    }
  }

  // Voice recording logic
  const onStartVoice = async () => {
    if (isRecording || isProcessingVoice) return;
    setIsRecording(true);
    setRecordingTime(0);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessingVoice(true);
        clearInterval(recordingTimerRef.current);
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], 'voice-query.webm', { type: 'audio/webm' });
          await sendVoiceQuery(file);
        } catch (err) {
          setMessages(m => [...m, { role: 'ai', text: 'Error processing voice input', sources: [], emotion: 'Neutral' }]);
        }
        setIsProcessingVoice(false);
        try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      };
      mediaRecorder.start();
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
      // Auto-stop after 30s
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, 30000);
    } catch (err) {
      setIsRecording(false);
      setMessages(m => [...m, { role: 'ai', text: 'Microphone permission denied or unavailable.', sources: [], emotion: 'Neutral' }]);
    }
  };

  const onStopVoice = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Send voice query to backend
  const sendVoiceQuery = async (audioFile) => {
    setAiTyping(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('not_authenticated');
      const token = await user.getIdToken();
      const form = new FormData();
      form.append('file', audioFile);
      const url = 'http://localhost:4000/api/query/voice';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err && err.error ? JSON.stringify(err.error) : 'voice_query_failed');
      }
      const data = await resp.json();
      // Debug: log backend data
      console.log('Voice backend response:', data);
      // Show transcribed text as user message, then AI response
      const userText = (typeof data.text === 'string' && data.text.trim().length > 0)
        ? data.text.trim()
        : '[Voice Query]';
      setMessages(m => [
        ...m,
        { role: 'user', text: userText, sources: [], emotion: data.emotion || 'Neutral' },
        { role: 'ai', text: data.answer || '', emotion: data.emotion || 'Neutral', sources: data.sources || [] }
      ]);
      if (voiceOutput && data.answer) handleSpeak(data.answer);
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: 'Error processing voice input', sources: [], emotion: 'Neutral' }]);
    } finally {
      setAiTyping(false);
    }
  };

  return (
    <div className="dashboard-root">
      <TopBar />
      <button className="new-chat-btn" onClick={handleNewChat}>
        <span className="new-chat-icon">&#x1F5E3;</span> New Chat
      </button>
      <div className="main-area">
        <DocumentPanel documents={documents} onUpload={uploadDocument} onDelete={deleteDocument} processing={processing} />
        <div className="right-col">
          <ChatWindow messages={messages} aiTyping={aiTyping || isProcessingVoice} />
          <MessageInput
            onSend={sendMessage}
            onStartVoice={onStartVoice}
            onStopVoice={onStopVoice}
            isRecording={isRecording}
            recordingTime={recordingTime}
            voiceOutput={voiceOutput}
            setVoiceOutput={setVoiceOutput}
            isProcessingVoice={isProcessingVoice}
          />
        </div>
      </div>
    </div>
  );
}
