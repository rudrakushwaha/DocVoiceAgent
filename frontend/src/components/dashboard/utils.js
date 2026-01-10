// mock utilities for the dashboard
export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function getAIResponse(message){
  // mock processing time
  await sleep(1200 + Math.random()*800);
  const emotions = ['Neutral','Happy','Frustrated','Surprised'];
  const emotion = emotions[Math.floor(Math.random()*emotions.length)];
  // mock sources
  const sources = Array.from({length: Math.ceil(Math.random()*3)}, (_,i)=>`chunk_${Math.floor(Math.random()*1000)}`);
  return {
    text: `AI response to: "${message.slice(0,120)}"\n\n(Generated mock answer)`,
    emotion,
    sources
  }
}

export function startVoiceRecording(){
  // placeholder: connect to WebRTC / speech-to-text
  console.log('startVoiceRecording() called - placeholder');
}

export function handleSpeak(text){
  // placeholder: integrate Web Speech API or TTS provider
  console.log('handleSpeak() placeholder - would speak:', text);
}
