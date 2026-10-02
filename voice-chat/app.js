import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
import { loadAgentState, buildAgentSystem, parseAgentOutput, applyAgentActions, restoreAgentUI } from './agent.js?v=20261002-1';

const chat=document.querySelector('#chat');
const input=document.querySelector('#input');
const send=document.querySelector('#send');
const mic=document.querySelector('#mic');
const statusEl=document.querySelector('#status');
const titleEl=document.querySelector('.title');

const MODEL='onnx-community/Qwen2.5-0.5B-Instruct';
const HISTORY_KEY='evo-chat-history-v1';
const agentState=loadAgentState();
let history=[];
try{
  const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(Array.isArray(saved)) history=saved.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-30);
}catch{}
let generator=null;
let ready=false;
let busy=false;
let recognition=null;

env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/';

function add(role,text){
  const el=document.createElement('div');
  el.className='msg '+(role==='user'?'user':'ai');
  el.textContent=text;
  chat.appendChild(el);
  chat.scrollTop=chat.scrollHeight;
  return el;
}

function setBusy(v){
  busy=v;
  send.disabled=v||!ready;
  mic.disabled=v;
}

function setStatus(text){
  statusEl.textContent=text;
  document.title=text+' | دردشة محلية';
}

function resize(){
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,140)+'px';
}

function saveHistory(){
  try{ localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-30))); }catch{}
}

for(const msg of history) add(msg.role,msg.content);
restoreAgentUI(agentState,{chat,input,titleEl});

async function loadModel(){
  setBusy(true);
  const progress=p=>{
    if(!p)return;
    if(p.status==='progress'&&typeof p.progress==='number'){
      setStatus('تنزيل النموذج… '+Math.round(p.progress)+'%');
    }else if(p.status==='initiate'){
      setStatus('جاري تنزيل ملفات النموذج…');
    }else if(p.status==='ready'){
      setStatus('جاري تشغيل النموذج…');
    }
  };

  if(navigator.gpu){
    try{
      setStatus('جاري التشغيل على GPU…');
      generator=await pipeline('text-generation',MODEL,{
        device:'webgpu',
        dtype:'q4f16',
        progress_callback:progress
      });
    }catch(e){
      generator=null;
    }
  }

  if(!generator){
    setStatus('جاري التشغيل على CPU…');
    generator=await pipeline('text-generation',MODEL,{
      device:'wasm',
      dtype:'int8',
      progress_callback:progress
    });
  }

  ready=true;
  setBusy(false);
  setStatus('جاهز');
  input.focus();
}

async function submit(){
  const text=input.value.trim();
  if(!text||busy||!ready)return;

  history.push({role:'user',content:text});
  saveHistory();
  add('user',text);
  input.value='';
  resize();
  setBusy(true);
  setStatus('يفكر…');

  try{
    await new Promise(r=>requestAnimationFrame(r));
    const modelMessages=[
      {role:'system',content:buildAgentSystem(agentState)},
      ...history.slice(-12)
    ];
    const out=await generator(modelMessages,{
      max_new_tokens:320,
      do_sample:true,
      temperature:0.7,
      top_p:0.9,
      repetition_penalty:1.05
    });
    const generated=out?.[0]?.generated_text;
    let answer='';
    if(Array.isArray(generated)) answer=generated.at(-1)?.content||'';
    else answer=String(generated||'');
    answer=answer.trim();
    const parsed=parseAgentOutput(answer);
    const applied=applyAgentActions(agentState,parsed.actions,{chat,input,titleEl});
    const visible=parsed.clean||applied.join('، ')||'تم.';
    history.push({role:'assistant',content:visible});
    saveHistory();
    add('assistant',visible);
    speak(visible);
    setStatus('جاهز');
  }catch(e){
    add('assistant','تعذر تشغيل النموذج: '+(e?.message||String(e)));
    setStatus('خطأ');
  }finally{
    setBusy(false);
  }
}

function speak(text){
  if(!text||!('speechSynthesis' in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  const voices=speechSynthesis.getVoices();
  u.voice=voices.find(v=>/^ar(-|_)/i.test(v.lang))||null;
  u.lang=u.voice?.lang||'ar-MA';
  u.rate=1;
  speechSynthesis.speak(u);
}

input.addEventListener('input',resize);
input.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    submit();
  }
});
send.addEventListener('click',submit);

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  recognition=new SR();
  recognition.lang='ar-MA';
  recognition.interimResults=true;
  recognition.continuous=false;
  let finalText='';

  recognition.onstart=()=>{
    mic.classList.add('listening');
    setStatus('أسمعك…');
    finalText='';
  };

  recognition.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText+=t;
      else interim+=t;
    }
    input.value=(finalText+interim).trim();
    resize();
  };

  recognition.onend=()=>{
    mic.classList.remove('listening');
    setStatus(ready?'جاهز':'جاري تجهيز النموذج…');
    if(input.value.trim()) submit();
  };

  recognition.onerror=e=>{
    mic.classList.remove('listening');
    setStatus('الميكروفون: '+e.error);
  };

  mic.addEventListener('click',()=>{
    if(busy)return;
    try{recognition.start();}catch{}
  });
}else{
  mic.disabled=true;
  mic.title='الإملاء الصوتي غير مدعوم في هذا المتصفح';
}

setBusy(true);
loadModel().catch(e=>{
  add('assistant','تعذر تشغيل النموذج: '+(e?.message||String(e)));
  setStatus('خطأ');
  setBusy(false);
});