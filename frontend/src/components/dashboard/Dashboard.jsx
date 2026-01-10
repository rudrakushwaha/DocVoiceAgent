import React, {useState} from 'react';
import './dashboard.css';
import TopBar from './TopBar';
import DocumentPanel from './DocumentPanel';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import { getAIResponse, startVoiceRecording, handleSpeak, sleep } from './utils';

export default function Dashboard(){
  const [documents, setDocuments] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [aiTyping, setAiTyping] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);

  const uploadDocument = async (file)=>{
    setProcessing(true);
    // simulate upload + embedding generation
    await sleep(1200 + Math.random()*1200);
    const doc = {id: Date.now().toString(), name: file.name, size: file.size};
    setDocuments(d=>[doc,...d]);
    setProcessing(false);
  }

  const deleteDocument = (id)=>{
    setDocuments(d=>d.filter(x=>x.id!==id));
  }

  const sendMessage = async (text)=>{
    // add user message
    setMessages(m=>[...m, {role:'user', text}]);
    // AI typing
    setAiTyping(true);
    try{
      const res = await getAIResponse(text);
      setAiTyping(false);
      setMessages(m=>[...m, {role:'ai', text:res.text, sources:res.sources, emotion:res.emotion}]);
      if(voiceOutput){ handleSpeak(res.text); }
    }catch(err){
      setAiTyping(false);
      setMessages(m=>[...m, {role:'ai', text:'Error generating response', sources:[], emotion:'Neutral'}]);
    }
  }

  const onStartVoice = ()=>{
    startVoiceRecording();
  }

  return (
    <div className="dashboard-root">
      <TopBar />
      <div className="main-area">
        <DocumentPanel documents={documents} onUpload={uploadDocument} onDelete={deleteDocument} processing={processing} />

        <div className="right-col">
          <ChatWindow messages={messages} aiTyping={aiTyping} />
          <MessageInput onSend={sendMessage} onStartVoice={onStartVoice} voiceOutput={voiceOutput} setVoiceOutput={setVoiceOutput} />
        </div>
      </div>
    </div>
  )
}
