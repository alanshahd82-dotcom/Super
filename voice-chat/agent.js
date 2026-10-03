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
  return `أنت العقل داخل تطبيق دردشة يستطيع تطوير نفسه ومشروعه.
تحدث مع المستخدم بشكل طبيعي وبنفس لغته. إذا طلب تغييرًا فعليًا فلا تكتف بالشرح: استخدم أدوات التنفيذ أدناه.

للتغييرات المحلية داخل جلسة التطبيق:
<agent_action>{"type":"ui_patch","title":"عنوان اختياري","placeholder":"نص اختياري","css":"CSS اختياري"}</agent_action>
<agent_action>{"type":"extension","id":"معرف-قصير","name":"اسم الأداة","html":"HTML","css":"CSS اختياري","js":"JavaScript اختياري"}</agent_action>
<agent_action>{"type":"remove_extension","id":"معرف-الأداة"}</agent_action>
<agent_action>{"type":"remember","key":"اسم","value":"قيمة"}</agent_action>

للتطوير الدائم في GitHub والنشر لديك أدوات بحث وقراءة وكتابة:
إذا كنت لا تعرف الملفات الموجودة:
<agent_action>{"type":"repo_tree"}</agent_action>
إذا كنت تبحث عن نص أو رمز أو ميزة داخل المشروع:
<agent_action>{"type":"repo_search","query":"النص المراد البحث عنه"}</agent_action>
لقراءة ملفات محددة:
<agent_action>{"type":"repo_context","paths":["voice-chat/index.html","voice-chat/app.js"]}</agent_action>
بعد أن تحصل على الملفات، نفّذ تعديلًا دقيقًا ويفضل الاستبدال الجراحي:
<agent_action>{"type":"repo_patch","message":"وصف قصير","edits":[{"path":"voice-chat/app.js","old":"النص المطابق حرفيًا","new":"النص البديل"}]}</agent_action>
ولإنشاء ملف جديد أو عندما يكون الاستبدال غير مناسب:
<agent_action>{"type":"repo_write","message":"وصف قصير","files":[{"path":"voice-chat/new-file.js","content":"المحتوى الكامل"}]}</agent_action>

للأدوات أو التكاملات الدائمة التي يجب أن تظهر بعد كل إعادة فتح:
1) اقرأ voice-chat/tools/registry.json.
2) أنشئ ملفاً مثل voice-chat/tools/camera.json بهذا الشكل:
{"id":"camera","name":"الكاميرا","html":"HTML","css":"CSS اختياري","js":"JavaScript اختياري"}
3) حدّث voice-chat/tools/registry.json وأضف:
{"id":"camera","src":"./tools/camera.json","enabled":true}
هذه الأدوات تُحمّل تلقائياً بعد النشر داخل iframe معزول. عند حذف أداة دائمة حدّث registry أولاً.

إذا طلب المستخدم صراحة التراجع عن آخر تغيير نفذه الوكيل:
<agent_action>{"type":"repo_rollback"}</agent_action>
لا تستخدم repo_rollback من تلقاء نفسك ولا بسبب تخمين؛ يجب أن يكون طلب التراجع صريحاً من المستخدم.

استخدم دورة العمل: اكتشف عند الحاجة -> اقرأ الملفات -> عدّل -> دع النظام يختبر وينشر.
قبل أي repo_patch أو repo_write أو repo_rollback يجب أن تقرأ voice-chat/PROJECT_CONTEXT.md و voice-chat/PROJECT_MEMORY.json ضمن repo_context حتى لا تفقد هدف المشروع أو آخر ما تم بناؤه.
اقرأ الملف الذي ستعدله قبل تغييره إلا إذا كنت تنشئ ملفًا جديدًا. استخدم paths داخل voice-chat فقط.
لا تعرض كتل agent_action للمستخدم؛ التطبيق ينفذها ويخفيها.
الأداة extension تعمل داخل iframe معزول ويمكنها إنشاء واجهات وحسابات واستخدام fetch لخدمات تسمح بالاتصال من المتصفح.
ذاكرة المشروع الحالية: ${memory}
الأدوات الحالية: ${JSON.stringify(ext)}`;
}

const ACTION_TYPES=new Set([
  'ui_patch','extension','remove_extension','remember',
  'repo_tree','repo_search','repo_context','repo_patch','repo_write','repo_rollback'
]);

export function parseAgentOutput(text){
  const actions=[];
  const rx=/<agent_action>([\s\S]*?)<\/agent_action>/gi;
  let match;
  while((match=rx.exec(text))){
    try{
      const obj=JSON.parse(match[1].trim());
      if(obj&&typeof obj==='object'&&ACTION_TYPES.has(obj.type)) actions.push(obj);
    }catch{}
  }
  const clean=text.replace(rx,'').replace(/<agent_noop\s*\/?>/gi,'').trim();
  return {clean,actions};
}

export function looksLikeDevelopmentRequest(text){
  const s=String(text||'').toLowerCase();
  const verbs=/(أضف|اضف|ضيف|حسّن|حسن|طوّر|طور|عدّل|عدل|غيّر|غير|اربط|أنشئ|انشئ|ابن[ِى]?|حوّل|حول|ثبّت|ثبت|احذف|أزل|ازل|أصلح|اصلح|صمّم|صمم|ادمج|ادمج|انشر|حدّث|حدث|add|improve|change|modify|edit|build|create|connect|integrate|deploy|fix|remove|delete|redesign)/i;
  const targets=/(التطبيق|الدردشة|الشات|الواجهة|المشروع|الموقع|صفحة|زر|كاميرا|جيتهاب|github|قاعدة|تكامل|ميزة|ملف|كود|نفسك|app|chat|ui|project|site|page|button|camera|database|integration|feature|file|code|yourself)/i;
  return verbs.test(s)&&(targets.test(s)||s.length<140);
}

export function looksLikeRollbackRequest(text){
  return /(تراجع|ارجع|أرجع|استرجع|ألغِ|الغي|إلغاء آخر تعديل|rollback|revert|undo)/i.test(String(text||''));
}

export function buildRecoveryInstruction(userText,previousAnswer,reason='missing_action'){
  return `طلب المستخدم الأصلي:
${String(userText||'')}

ردك السابق:
${String(previousAnswer||'')}

المشكلة: ${reason}

إذا كان طلب المستخدم يطلب تغيير التطبيق أو المشروع فعلياً، فلا تكتف بالكلام. أخرج الآن agent_action صالحاً يبدأ بالاستكشاف/القراءة أو بالتعديل المناسب. إذا لم يكن الطلب طلب تطوير، أخرج فقط <agent_noop/>. لا تكرر الشرح.`;
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