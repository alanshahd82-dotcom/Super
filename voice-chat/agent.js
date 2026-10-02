const STATE_KEY='evo-agent-state-v1';
const DEFAULT_STATE={
  ui:{title:'دردشة',placeholder:'اكتب أو تكلم…',css:''},
  extensions:[],
  memory:{}
};

function cloneDefault(){
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export function loadAgentState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STATE_KEY)||'null');
    if(!raw||typeof raw!=='object') return cloneDefault();
    return {
      ui:{...DEFAULT_STATE.ui,...(raw.ui||{})},
      extensions:Array.isArray(raw.extensions)?raw.extensions:[],
      memory:raw.memory&&typeof raw.memory==='object'?raw.memory:{}
    };
  }catch{
    return cloneDefault();
  }
}

function saveState(state){
  localStorage.setItem(STATE_KEY,JSON.stringify(state));
}export function buildAgentSystem(state){
  const memory=JSON.stringify(state.memory||{});
  const ext=(state.extensions||[]).map(x=>({id:x.id,name:x.name}));
  return `أنت العقل داخل تطبيق دردشة قابل للتطور أثناء الاستخدام.
تحدث مع المستخدم بشكل طبيعي وبنفس لغته.
عندما يطلب المستخدم تغيير التطبيق أو إضافة أداة أو تكامل، نفّذ ذلك بإضافة كتلة أو أكثر في آخر ردك بهذا الشكل فقط:
<agent_action>{"type":"ui_patch","title":"عنوان اختياري","placeholder":"نص اختياري","css":"CSS اختياري"}</agent_action>
<agent_action>{"type":"extension","id":"معرف-قصير","name":"اسم الأداة","html":"HTML","css":"CSS اختياري","js":"JavaScript اختياري"}</agent_action>
<agent_action>{"type":"remove_extension","id":"معرف-الأداة"}</agent_action>
<agent_action>{"type":"remember","key":"اسم","value":"قيمة"}</agent_action>
الأداة extension تعمل داخل iframe معزول ويمكنها إنشاء واجهات وحسابات واستخدام fetch لخدمات تسمح بالاتصال من المتصفح.
لا تكتب agent_action إلا عندما يريد المستخدم تنفيذ تغيير فعلي. لا تعرض كتل التنفيذ داخل الشرح.
ذاكرة المشروع الحالية: ${memory}
الأدوات الحالية: ${JSON.stringify(ext)}`;
}

export function parseAgentOutput(text){
  const actions=[];
  const rx=/<agent_action>([\s\S]*?)<\/agent_action>/gi;
  let match;
  while((match=rx.exec(text))){
    try{
      const obj=JSON.parse(match[1].trim());
      if(obj&&typeof obj==='object') actions.push(obj);
    }catch{}
  }
  const clean=text.replace(rx,'').trim();
  return {clean,actions};
}function safeId(value){
  return String(value||'').trim().replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,64);
}

function buildSrcdoc(ext){
  const css=String(ext.css||'');
  const html=String(ext.html||'');
  const js=String(ext.js||'').replace(/<\/script/gi,'<\\/script');
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:#11151b;color:#f5f7fa;font-family:system-ui}*{box-sizing:border-box}${css}</style>
</head><body>${html}<script>${js}<\/script></body></html>`;
}

export function renderExtension(ext,chat){
  const old=document.querySelector('[data-agent-extension="'+ext.id+'"]');
  if(old) old.remove();
  const card=document.createElement('section');
  card.className='agent-card';
  card.dataset.agentExtension=ext.id;
  const head=document.createElement('div');
  head.className='agent-card-title';
  head.textContent='🧩 '+(ext.name||ext.id);
  const frame=document.createElement('iframe');
  frame.className='agent-frame';
  frame.sandbox='allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox';
  frame.srcdoc=buildSrcdoc(ext);
  card.append(head,frame);
  chat.appendChild(card);
  chat.scrollTop=chat.scrollHeight;
}

export function restoreAgentUI(state,ctx){
  if(state.ui.title) ctx.titleEl.textContent=state.ui.title;
  if(state.ui.placeholder) ctx.input.placeholder=state.ui.placeholder;
  let style=document.querySelector('#agent-user-style');
  if(!style){
    style=document.createElement('style');
    style.id='agent-user-style';
    document.head.appendChild(style);
  }
  style.textContent=state.ui.css||'';
  for(const ext of state.extensions||[]) renderExtension(ext,ctx.chat);
}export function applyAgentActions(state,actions,ctx){
  const applied=[];
  for(const action of actions){
    if(!action||typeof action!=='object') continue;
    if(JSON.stringify(action).length>200000) continue;

    if(action.type==='ui_patch'){
      if(typeof action.title==='string') state.ui.title=action.title.slice(0,80);
      if(typeof action.placeholder==='string') state.ui.placeholder=action.placeholder.slice(0,160);
      if(typeof action.css==='string') state.ui.css=action.css.slice(0,100000);
      restoreAgentUI(state,ctx);
      applied.push('تم تحديث واجهة الدردشة');
      continue;
    }

    if(action.type==='extension'){
      const id=safeId(action.id);
      if(!id||typeof action.name!=='string'||typeof action.html!=='string') continue;
      const ext={
        id,
        name:action.name.slice(0,80),
        html:action.html.slice(0,120000),
        css:String(action.css||'').slice(0,100000),
        js:String(action.js||'').slice(0,120000)
      };
      const i=state.extensions.findIndex(x=>x.id===id);
      if(i>=0) state.extensions[i]=ext;
      else state.extensions.push(ext);
      renderExtension(ext,ctx.chat);
      applied.push('تم إنشاء '+ext.name);
      continue;
    }    if(action.type==='remove_extension'){
      const id=safeId(action.id);
      state.extensions=state.extensions.filter(x=>x.id!==id);
      document.querySelector('[data-agent-extension="'+id+'"]')?.remove();
      applied.push('تم حذف الأداة '+id);
      continue;
    }

    if(action.type==='remember'&&typeof action.key==='string'){
      state.memory[action.key.slice(0,80)]=String(action.value??'').slice(0,4000);
      applied.push('تم حفظ المعلومة');
    }
  }
  saveState(state);
  return applied;
}