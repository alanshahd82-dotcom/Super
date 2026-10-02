import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
import { loadAgentState, buildAgentSystem, parseAgentOutput, applyAgentActions, restoreAgentUI } from './agent.js?v=20261002-4';
import { bridgeHealth, pairBridge, bridgeContext, bridgeTree, bridgeSearch, bridgeApply, hasBridgeToken } from './bridge.js?v=20261002-2';

const chat=document.querySelector('#chat');
const input=document.querySelector('#input');
const send=document.querySelector('#send');
const mic=document.querySelector('#mic');
const statusEl=document.querySelector('#status');
const titleEl=document.querySelector('.title');
const bridgeStatusEl=document.querySelector('#bridgeStatus');
const pairModal=document.querySelector('#pairModal');
const pairCodeEl=document.querySelector('#pairCode');
const pairSubmitEl=document.querySelector('#pairSubmit');
const pairErrorEl=document.querySelector('#pairError');

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

let bridgeOnline=false;

function setBridgeBadge(online,paired){
  bridgeOnline=online;
  bridgeStatusEl.classList.toggle('online',online&&paired);
  bridgeStatusEl.classList.toggle('offline',!(online&&paired));
  bridgeStatusEl.textContent=online?(paired?'GitHub ✓':'ربط GitHub'):'GitHub ×';
}

async function refreshBridge(){
  const state=await bridgeHealth();
  setBridgeBadge(state.online,hasBridgeToken());
  return state;
}

function showPairModal(){
  pairErrorEl.textContent='';
  pairCodeEl.value='';
  pairModal.hidden=false;
  setTimeout(()=>pairCodeEl.focus(),50);
}

function hidePairModal(){
  pairModal.hidden=true;
}

bridgeStatusEl.addEventListener('click',async()=>{
  const state=await refreshBridge();
  if(state.online&&!hasBridgeToken()) showPairModal();
});

pairModal.addEventListener('click',e=>{
  if(e.target===pairModal) hidePairModal();
});

pairSubmitEl.addEventListener('click',async()=>{
  const code=pairCodeEl.value.trim();
  if(!/^\d{6}$/.test(code)){
    pairErrorEl.textContent='أدخل رمزًا من 6 أرقام.';
    return;
  }
  pairSubmitEl.disabled=true;
  pairErrorEl.textContent='جاري الربط…';
  try{
    await pairBridge(code);
    pairErrorEl.textContent='';
    hidePairModal();
    await refreshBridge();
    add('assistant','تم ربط GitHub. أستطيع الآن قراءة ملفات المشروع وتعديلها ونشر التغييرات من داخل الدردشة.');
  }catch(e){
    pairErrorEl.textContent='تعذر الربط: '+(e?.message||String(e));
  }finally{
    pairSubmitEl.disabled=false;
  }
});

pairCodeEl.addEventListener('keydown',e=>{
  if(e.key==='Enter') pairSubmitEl.click();
});

refreshBridge().catch(()=>setBridgeBadge(false,hasBridgeToken()));

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

async function generateText(messages,maxNewTokens=520){
  const out=await generator(messages,{
    max_new_tokens:maxNewTokens,
    do_sample:true,
    temperature:0.65,
    top_p:0.9,
    repetition_penalty:1.05
  });
  const generated=out?.[0]?.generated_text;
  let answer='';
  if(Array.isArray(generated)) answer=generated.at(-1)?.content||'';
  else answer=String(generated||'');
  return answer.trim();
}

function isRepoReadAction(action){
  return ['repo_context','repo_tree','repo_search'].includes(action?.type);
}

function isRepoWriteAction(action){
  return ['repo_patch','repo_write'].includes(action?.type);
}

function isRepoAction(action){
  return isRepoReadAction(action)||isRepoWriteAction(action);
}

function formatContextResult(ctx){
  return (ctx.files||[]).map(f=>{
    if(f.missing) return 'FILE '+f.path+' [MISSING]';
    if(f.error) return 'FILE '+f.path+' ['+f.error+']';
    return 'FILE '+f.path+'\n---\n'+f.content+'\n---';
  }).join('\n\n');
}

async function executeAgentPlan(parsed,modelMessages){
  let actions=[...parsed.actions];
  let visible=parsed.clean;
  const notes=[];
  let lastRepoHead=null;
  let workingMessages=[...modelMessages];

  for(let round=0;round<3;round++){
    let readActions=actions.filter(isRepoReadAction);
    const writeActions=actions.filter(isRepoWriteAction);

    if(!readActions.length&&writeActions.length&&!lastRepoHead){
      const targets=[
        ...writeActions.flatMap(a=>Array.isArray(a.edits)?a.edits.map(x=>x.path):[]),
        ...writeActions.flatMap(a=>Array.isArray(a.files)?a.files.map(x=>x.path):[])
      ].filter(Boolean);
      readActions=[{
        type:'repo_context',
        paths:['voice-chat/PROJECT_CONTEXT.md',...targets]
      }];
    }

    if(!readActions.length) break;

    const state=await refreshBridge();
    if(!state.online||!hasBridgeToken()){
      if(state.online) showPairModal();
      notes.push(state.online?'يلزم ربط GitHub مرة واحدة لإكمال التطوير الدائم.':'جسر التطوير غير متصل حاليًا.');
      actions=actions.filter(a=>!isRepoAction(a));
      break;
    }

    const toolResults=[];
    for(const action of readActions){
      if(action.type==='repo_context'){
        const paths=[...new Set(['voice-chat/PROJECT_CONTEXT.md',...(Array.isArray(action.paths)?action.paths:[])])].slice(0,10);
        setStatus('يقرأ ملفات المشروع…');
        const ctx=await bridgeContext(paths);
        lastRepoHead=ctx.head||lastRepoHead;
        toolResults.push('CONTEXT HEAD '+ctx.head+'\n'+formatContextResult(ctx));
      }else if(action.type==='repo_tree'){
        setStatus('يفحص ملفات المشروع…');
        const tree=await bridgeTree();
        lastRepoHead=tree.head||lastRepoHead;
        const listing=(tree.files||[]).map(f=>f.path+' ('+f.size+' bytes)').join('\n');
        toolResults.push('PROJECT TREE HEAD '+tree.head+'\n'+listing);
      }else if(action.type==='repo_search'){
        setStatus('يبحث داخل المشروع…');
        const found=await bridgeSearch(action.query,action.paths);
        lastRepoHead=found.head||lastRepoHead;
        const matches=(found.matches||[]).map(m=>m.path+':'+m.line+' '+m.excerpt).join('\n');
        toolResults.push('SEARCH "'+found.query+'" HEAD '+found.head+'\n'+(matches||'[NO MATCHES]'));
      }
    }

    workingMessages=[
      ...workingMessages,
      {role:'assistant',content:visible||'أحتاج معلومات من المشروع قبل التنفيذ.'},
      {
        role:'system',
        content:'نتائج أدوات المشروع أدناه. واصل تنفيذ طلب المستخدم. إذا أصبحت المعلومات كافية، أخرج repo_patch أو repo_write. إذا ما زلت تحتاج معلومات، استخدم repo_tree أو repo_search أو repo_context فقط للخطوة التالية.\n\n'+toolResults.join('\n\n')
      }
    ];

    setStatus('يحلل المشروع…');
    const followAnswer=await generateText(workingMessages,760);
    const next=parseAgentOutput(followAnswer);
    actions=[...next.actions];
    if(next.clean) visible=next.clean;
  }

  const localActions=actions.filter(a=>!isRepoAction(a));
  const localApplied=applyAgentActions(agentState,localActions,{chat,input,titleEl});
  notes.push(...localApplied);

  const repoPatches=actions.filter(a=>a?.type==='repo_patch');
  const repoWrites=actions.filter(a=>a?.type==='repo_write');
  if(repoPatches.length||repoWrites.length){
    const state=await refreshBridge();
    if(!state.online||!hasBridgeToken()){
      if(state.online) showPairModal();
      notes.push(state.online?'يلزم ربط GitHub مرة واحدة قبل النشر.':'جسر التطوير غير متصل حاليًا.');
    }else if(!lastRepoHead){
      notes.push('لم يتم نشر التعديل لأن الوكيل لم يقرأ سياق المشروع أولًا.');
    }else{
      const edits=repoPatches.flatMap(a=>Array.isArray(a.edits)?a.edits:[]).slice(0,16);
      const files=repoWrites.flatMap(a=>Array.isArray(a.files)?a.files:[]).slice(0,12);
      const message=[...repoPatches,...repoWrites].map(a=>a.message).find(Boolean)||'self update';
      setStatus('يختبر وينشر…');
      const result=await bridgeApply({
        message,
        edits,
        files,
        expected_head:lastRepoHead
      });
      if(result.no_changes){
        notes.push('لم تكن هناك تغييرات جديدة للنشر.');
      }else if(result.commit){
        notes.push('تم الاختبار والنشر على GitHub: '+result.commit.slice(0,7));
        if(result.live_url) notes.push('النسخة المنشورة: '+result.live_url);
      }
      await refreshBridge();
    }
  }

  return {visible:(visible||'').trim(),notes};
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
    const answer=await generateText(modelMessages,520);
    const parsed=parseAgentOutput(answer);
    const result=await executeAgentPlan(parsed,modelMessages);
    const parts=[];
    if(result.visible) parts.push(result.visible);
    if(result.notes.length) parts.push(result.notes.join('\n'));
    const visible=parts.join('\n\n')||'تم.';
    history.push({role:'assistant',content:visible});
    saveHistory();
    add('assistant',visible);
    speak(visible);
    setStatus('جاهز');
  }catch(e){
    add('assistant','تعذر التنفيذ: '+(e?.message||String(e)));
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

if('serviceWorker' in navigator){
  addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

setBusy(true);
loadModel().catch(e=>{
  add('assistant','تعذر تشغيل النموذج: '+(e?.message||String(e)));
  setStatus('خطأ');
  setBusy(false);
});