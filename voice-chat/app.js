import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
import { loadAgentState, buildAgentSystem, parseAgentOutput, applyAgentActions, restoreAgentUI, looksLikeDevelopmentRequest, looksLikeRollbackRequest, buildRecoveryInstruction } from './agent.js?v=20261002-8';
import { bridgeHealth, pairBridge, bridgeGenerate, bridgeContext, bridgeTree, bridgeSearch, bridgeApply, bridgeRollback, hasBridgeToken } from './bridge.js?v=20261002-4';

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

const CHAT_MODEL='onnx-community/Qwen2.5-0.5B-Instruct';
const DEV_MODEL='onnx-community/Qwen2.5-Coder-0.5B-Instruct';
const HISTORY_KEY='evo-chat-history-v1';
const TASK_KEY='evo-active-agent-task-v1';
const agentState=loadAgentState();

function newTaskId(){
  if(globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'task-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
}

function loadTask(){
  try{
    const task=JSON.parse(localStorage.getItem(TASK_KEY)||'null');
    return task&&typeof task==='object'?task:null;
  }catch{return null;}
}

function saveTask(task){
  try{localStorage.setItem(TASK_KEY,JSON.stringify(task));}catch{}
}

function createTask(text){
  const task={
    id:newTaskId(),
    text:String(text||''),
    status:'running',
    attempts:1,
    started_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  saveTask(task);
  return task;
}

function updateTask(task,patch){
  if(!task) return null;
  Object.assign(task,patch,{updated_at:new Date().toISOString()});
  saveTask(task);
  return task;
}
let history=[];
try{
  const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(Array.isArray(saved)) history=saved.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-30);
}catch{}
let generator=null;
let currentModelId=null;
let ready=true;
let busy=false;
let recognition=null;
let modelIdleTimer=null;

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

async function loadModel(mode='chat'){
  if(modelIdleTimer){
    clearTimeout(modelIdleTimer);
    modelIdleTimer=null;
  }

  const wantedModel=mode==='dev'?DEV_MODEL:CHAT_MODEL;
  if(generator&&currentModelId===wantedModel) return;

  if(generator&&currentModelId!==wantedModel){
    const old=generator;
    generator=null;
    currentModelId=null;
    try{
      if(typeof old.dispose==='function') await old.dispose();
    }catch{}
  }

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
      setStatus('جاري تشغيل العقل على GPU…');
      generator=await pipeline('text-generation',wantedModel,{
        device:'webgpu',
        dtype:'q4f16',
        progress_callback:progress
      });
    }catch(e){
      generator=null;
    }
  }

  if(!generator){
    setStatus('جاري تشغيل العقل على CPU…');
    generator=await pipeline('text-generation',wantedModel,{
      device:'wasm',
      dtype:'int8',
      progress_callback:progress
    });
  }

  currentModelId=wantedModel;
  setStatus(mode==='dev'?'جاهز — عقل البرمجة':'جاهز');
}

function scheduleModelUnload(){
  if(modelIdleTimer) clearTimeout(modelIdleTimer);
  modelIdleTimer=setTimeout(async()=>{
    const old=generator;
    generator=null;
    currentModelId=null;
    try{
      if(old&&typeof old.dispose==='function') await old.dispose();
    }catch{}
    setStatus('جاهز — العقل يعمل عند الطلب');
  },120000);
}

async function generateText(messages,maxNewTokens=520,mode='chat'){
  if(hasBridgeToken()){
    try{
      if(!bridgeOnline) await refreshBridge();
      if(bridgeOnline){
        setStatus(mode==='dev'?'يفكر عقل البرمجة على الحاسوب…':'يفكر على الحاسوب…');
        const remote=await bridgeGenerate(messages,maxNewTokens,mode);
        if(remote?.text) return String(remote.text).trim();
      }
    }catch{
      setBridgeBadge(false,hasBridgeToken());
    }
  }

  await loadModel(mode);
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
  scheduleModelUnload();
  return answer.trim();
}

function isRepoReadAction(action){
  return ['repo_context','repo_tree','repo_search'].includes(action?.type);
}

function isRepoWriteAction(action){
  return ['repo_patch','repo_write','repo_rollback'].includes(action?.type);
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

async function recoverInitialPlan(userText,modelMessages,answer){
  let parsed=parseAgentOutput(answer);
  if(parsed.actions.length||!(looksLikeDevelopmentRequest(userText)||looksLikeRollbackRequest(userText))) return parsed;
  let previous=answer;
  for(let attempt=1;attempt<=2;attempt++){
    setStatus('يعيد التخطيط… '+attempt+'/2');
    const repaired=await generateText([
      ...modelMessages,
      {role:'assistant',content:previous||''},
      {role:'system',content:buildRecoveryInstruction(userText,previous,'missing_action')}
    ],520,'dev');
    parsed=parseAgentOutput(repaired);
    if(parsed.actions.length) return parsed;
    previous=repaired;
  }
  return parsed;
}

function collectRepoTargets(patches,writes){
  return [...new Set([
    ...patches.flatMap(a=>Array.isArray(a?.edits)?a.edits.map(x=>x?.path):[]),
    ...writes.flatMap(a=>Array.isArray(a?.files)?a.files.map(x=>x?.path):[])
  ].filter(Boolean))].slice(0,9);
}

async function applyRepoChangesWithRepair(patches,writes,head,workingMessages,visible,requestId){
  let currentPatches=[...patches];
  let currentWrites=[...writes];
  let currentHead=head;
  let currentVisible=visible;

  for(let attempt=0;attempt<2;attempt++){
    const edits=currentPatches.flatMap(a=>Array.isArray(a.edits)?a.edits:[]).slice(0,16);
    const files=currentWrites.flatMap(a=>Array.isArray(a.files)?a.files:[]).slice(0,12);
    const message=[...currentPatches,...currentWrites].map(a=>a.message).find(Boolean)||'self update';
    try{
      setStatus(attempt?'يعيد الاختبار والنشر…':'يختبر وينشر…');
      const result=await bridgeApply({
        message,
        edits,
        files,
        expected_head:currentHead,
        request_id:requestId||null
      });
      return {result,visible:currentVisible};
    }catch(e){
      const reason=e?.message||String(e);
      if(attempt>0||!/repository_changed|edit_match_missing|edit_match_not_unique/.test(reason)) throw e;

      setStatus('يصحح التعديل تلقائيًا…');
      const ctx=await bridgeContext([
        'voice-chat/PROJECT_CONTEXT.md',
        'voice-chat/PROJECT_MEMORY.json',
        ...collectRepoTargets(currentPatches,currentWrites)
      ]);
      currentHead=ctx.head;
      const repairAnswer=await generateText([
        ...workingMessages,
        {
          role:'system',
          content:'فشل تطبيق التعديل السابق بسبب: '+reason+'\nهذه هي الملفات الحالية. صحح التعديل وأخرج repo_patch أو repo_write فقط، دون تكرار الخطأ.\n\n'+formatContextResult(ctx)
        }
      ],920,'dev');
      const repaired=parseAgentOutput(repairAnswer);
      currentPatches=repaired.actions.filter(a=>a?.type==='repo_patch');
      currentWrites=repaired.actions.filter(a=>a?.type==='repo_write');
      if(!currentPatches.length&&!currentWrites.length) throw new Error('auto_repair_failed: '+reason);
      if(repaired.clean) currentVisible=repaired.clean;
    }
  }
  throw new Error('auto_repair_failed');
}

async function executeAgentPlan(parsed,modelMessages,userText,taskId=null){
  let actions=[...parsed.actions];
  let visible=parsed.clean;
  const notes=[];
  let executed=false;
  let executionMeta={};
  const rollbackIntent=looksLikeRollbackRequest(userText);
  const devIntent=looksLikeDevelopmentRequest(userText)||rollbackIntent;
  let lastRepoHead=null;
  let workingMessages=[...modelMessages];

  for(let round=0;round<4;round++){
    let readActions=actions.filter(isRepoReadAction);
    const writeActions=actions.filter(isRepoWriteAction);

    if(!readActions.length&&writeActions.length&&!lastRepoHead){
      const targets=[
        ...writeActions.flatMap(a=>Array.isArray(a.edits)?a.edits.map(x=>x.path):[]),
        ...writeActions.flatMap(a=>Array.isArray(a.files)?a.files.map(x=>x.path):[])
      ].filter(Boolean);
      readActions=[{
        type:'repo_context',
        paths:['voice-chat/PROJECT_CONTEXT.md','voice-chat/PROJECT_MEMORY.json',...targets]
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
        const paths=[...new Set(['voice-chat/PROJECT_CONTEXT.md','voice-chat/PROJECT_MEMORY.json',...(Array.isArray(action.paths)?action.paths:[])])].slice(0,10);
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
        content:'نتائج أدوات المشروع أدناه. واصل تنفيذ طلب المستخدم. إذا أصبحت المعلومات كافية، أخرج repo_patch أو repo_write، أو repo_rollback فقط إذا طلب المستخدم التراجع صراحة. إذا ما زلت تحتاج معلومات، استخدم repo_tree أو repo_search أو repo_context فقط للخطوة التالية.\n\n'+toolResults.join('\n\n')
      }
    ];

    setStatus('يحلل المشروع…');
    const followAnswer=await generateText(workingMessages,760,'dev');
    const next=parseAgentOutput(followAnswer);
    actions=[...next.actions];
    if(next.clean) visible=next.clean;
  }

  if(devIntent&&actions.length&&actions.every(isRepoReadAction)){
    setStatus('يحوّل الخطة إلى تنفيذ…');
    const forced=await generateText([
      ...workingMessages,
      {role:'system',content:'انتهت مرحلة القراءة. لا تطلب قراءة أخرى. نفّذ طلب المستخدم الآن بإخراج repo_patch أو repo_write صالح، أو repo_rollback فقط إذا كان المستخدم قد طلب التراجع صراحة. إذا يوجد مانع تقني حقيقي، اذكره باختصار.'}
    ],900,'dev');
    const forcedParsed=parseAgentOutput(forced);
    if(forcedParsed.actions.length) actions=[...forcedParsed.actions];
    if(forcedParsed.clean) visible=forcedParsed.clean;
  }

  if(!rollbackIntent&&actions.some(a=>a?.type==='repo_rollback')){
    actions=actions.filter(a=>a?.type!=='repo_rollback');
    notes.push('تم تجاهل أمر تراجع لم يطلبه المستخدم صراحة.');
  }

  const localActions=actions.filter(a=>!isRepoAction(a));
  const localApplied=applyAgentActions(agentState,localActions,{chat,input,titleEl});
  if(localApplied.length) executed=true;
  notes.push(...localApplied);

  const repoPatches=actions.filter(a=>a?.type==='repo_patch');
  const repoWrites=actions.filter(a=>a?.type==='repo_write');
  const repoRollbacks=actions.filter(a=>a?.type==='repo_rollback');
  if(repoPatches.length||repoWrites.length||repoRollbacks.length){
    const state=await refreshBridge();
    if(!state.online||!hasBridgeToken()){
      if(state.online) showPairModal();
      notes.push(state.online?'يلزم ربط GitHub مرة واحدة قبل النشر.':'جسر التطوير غير متصل حاليًا.');
    }else if(!lastRepoHead){
      notes.push('لم يتم نشر التعديل لأن الوكيل لم يقرأ سياق المشروع أولًا.');
    }else{
      let result=null;
      if(repoRollbacks.length){
        setStatus('يتراجع عن آخر تغيير للوكيل…');
        result=await bridgeRollback(lastRepoHead);
        if(result.no_changes){
          executed=true;
          notes.push('لا يوجد تغيير فعلي للتراجع عنه.');
        }else if(result.commit){
          executed=true;
          executionMeta={commit:result.commit,rolled_back:result.rolled_back||null};
          notes.push('تم التراجع عن التغيير '+String(result.rolled_back||'').slice(0,7)+' في Commit جديد: '+result.commit.slice(0,7));
        }
      }else{
        const applied=await applyRepoChangesWithRepair(
          repoPatches,
          repoWrites,
          lastRepoHead,
          workingMessages,
          visible,
          taskId
        );
        result=applied.result;
        if(applied.visible) visible=applied.visible;
        if(result.no_changes){
          executed=true;
          notes.push('لم تكن هناك تغييرات جديدة للنشر.');
        }else if(result.duplicate){
          executed=true;
          executionMeta={commit:result.commit||null,duplicate:true,request_id:result.request_id||taskId||null};
          notes.push('هذه المهمة سبق تنفيذها؛ تم منع تكرار نفس التعديل.');
        }else if(result.commit){
          executed=true;
          executionMeta={commit:result.commit,request_id:result.request_id||taskId||null};
          notes.push('تم الاختبار ورفع التعديل إلى GitHub: '+result.commit.slice(0,7));
        }
      }
      if(result?.commit){
        notes.push(result.deployed?'تم التأكد أن GitHub Pages نشر النسخة الجديدة فعليًا.':'تم الرفع، لكن لم يصل تأكيد النشر الحي ضمن مهلة التحقق.');
        if(result.live_url) notes.push('النسخة المنشورة: '+result.live_url);
      }
      await refreshBridge();
    }
  }else if(devIntent&&!localActions.length){
    notes.push('أعاد الوكيل التخطيط تلقائيًا، لكنه لم ينتج تعديلًا صالحًا؛ لذلك لم يغيّر المشروع.');
  }

  return {visible:(visible||'').trim(),notes,executed,executionMeta};
}

async function submit(options={}){
  const resumeTask=options?.resumeTask&&typeof options.resumeTask==='object'?options.resumeTask:null;
  const text=String(resumeTask?.text??input.value).trim();
  if(!text||busy||!ready)return;

  const devMode=looksLikeDevelopmentRequest(text)||looksLikeRollbackRequest(text);
  let task=null;
  if(devMode){
    task=resumeTask||createTask(text);
    if(resumeTask){
      updateTask(task,{
        status:'running',
        attempts:Number(task.attempts||0)+1,
        resumed_at:new Date().toISOString()
      });
    }
  }

  const lastUser=[...history].reverse().find(x=>x.role==='user');
  if(!resumeTask||lastUser?.content!==text){
    history.push({role:'user',content:text});
    saveHistory();
    add('user',text);
  }else{
    add('assistant','أستأنف مهمة التطوير التي توقفت قبل اكتمالها…');
  }

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
    const mode=devMode?'dev':'chat';
    const answer=await generateText(modelMessages,520,mode);
    const parsed=await recoverInitialPlan(text,modelMessages,answer);
    const result=await executeAgentPlan(parsed,modelMessages,text,task?.id||null);
    const parts=[];
    if(result.visible) parts.push(result.visible);
    if(result.notes.length) parts.push(result.notes.join('\n'));
    const visible=parts.join('\n\n')||'تم.';
    history.push({role:'assistant',content:visible});
    saveHistory();
    add('assistant',visible);
    speak(visible);

    if(task){
      updateTask(task,{
        status:result.executed?'completed':'blocked',
        completed_at:result.executed?new Date().toISOString():null,
        execution:result.executionMeta||{},
        last_message:visible.slice(0,1500)
      });
    }
    setStatus('جاهز');
  }catch(e){
    const message=e?.message||String(e);
    if(task){
      updateTask(task,{
        status:'failed',
        error:message.slice(0,1000)
      });
    }
    add('assistant','تعذر التنفيذ: '+message);
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

function resumeInterruptedTask(){
  const task=loadTask();
  if(!task||task.status!=='running'||!task.text) return;
  const updated=Date.parse(task.updated_at||task.started_at||0);
  if(!Number.isFinite(updated)||Date.now()-updated>6*60*60*1000) return;
  if(Number(task.attempts||0)>=3){
    updateTask(task,{status:'blocked',error:'resume_attempt_limit'});
    return;
  }
  setTimeout(()=>{
    if(!busy) submit({resumeTask:task});
  },1200);
}

setBusy(false);
setStatus('جاهز — العقل يعمل عند الطلب');
input.focus();
resumeInterruptedTask();