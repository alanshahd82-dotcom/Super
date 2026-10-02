const chat=document.querySelector('#chat');
const input=document.querySelector('#input');
const send=document.querySelector('#send');
const mic=document.querySelector('#mic');
const statusEl=document.querySelector('#status');
const worker=new Worker('./worker.js',{type:'module'});
worker.onerror=(e)=>{statusEl.textContent='خطأ تحميل النموذج';add('assistant','خطأ تحميل النموذج: '+(e.message||'غير معروف'));setBusy(false);};
const history=[];
let ready=false,busy=false;
let recognition=null;

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
function resize(){
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,140)+'px';
}input.addEventListener('input',resize);
input.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}
});
worker.onmessage=({data})=>{
  if(data.type==='status') statusEl.textContent=data.text;
  if(data.type==='ready'){
    ready=true;setBusy(false);
    statusEl.textContent=data.device==='webgpu'?'جاهز — GPU':'جاهز — CPU';
    input.focus();
  }
  if(data.type==='answer'){
    const text=(data.text||'').trim();
    history.push({role:'assistant',content:text});
    add('assistant',text||'…');
    setBusy(false);statusEl.textContent='جاهز';
    speak(text);
  }
  if(data.type==='error'){
    add('assistant','تعذر تشغيل النموذج: '+data.message);
    statusEl.textContent='خطأ';setBusy(false);
  }
};
worker.onerror=(e)=>{
  add('assistant','تعذر تشغيل النموذج: '+(e.message||'خطأ غير معروف'));
  statusEl.textContent='خطأ';setBusy(false);
};
function submit(){
  const text=input.value.trim();
  if(!text||busy||!ready)return;
  history.push({role:'user',content:text});
  add('user',text);
  input.value='';resize();
  setBusy(true);statusEl.textContent='يفكر…';
  worker.postMessage({type:'generate',messages:history});
}
send.addEventListener('click',submit);

function speak(text){
  if(!text||!('speechSynthesis'in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  const voices=speechSynthesis.getVoices();
  u.voice=voices.find(v=>/^ar(-|_)/i.test(v.lang))||null;
  u.lang=u.voice?.lang||'ar-MA';
  u.rate=1;
  speechSynthesis.speak(u);
}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  recognition=new SR();
  recognition.lang='ar-MA';
  recognition.interimResults=true;
  recognition.continuous=false;
  let finalText='';
  recognition.onstart=()=>{mic.classList.add('listening');statusEl.textContent='أسمعك…';finalText='';};
  recognition.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText+=t; else interim+=t;
    }
    input.value=(finalText+interim).trim();resize();
  };
  recognition.onend=()=>{
    mic.classList.remove('listening');
    statusEl.textContent=ready?'جاهز':'جاري تجهيز النموذج…';
    if(input.value.trim())submit();
  };
  recognition.onerror=e=>{mic.classList.remove('listening');statusEl.textContent='الميكروفون: '+e.error;};  mic.addEventListener('click',()=>{
    if(busy)return;
    try{recognition.start();}catch{}
  });
}else{
  mic.disabled=true;
  mic.title='الإملاء الصوتي غير مدعوم في هذا المتصفح';
}

setBusy(true);
worker.postMessage({type:'load',hasWebGPU:!!navigator.gpu});