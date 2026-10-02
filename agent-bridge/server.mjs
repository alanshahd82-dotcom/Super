import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync=promisify(execFile);
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(process.env.SUPER_REPO||path.join(__dirname,'..'));
const PORT=Number(process.env.SUPER_BRIDGE_PORT||8788);
const RUNTIME=path.join(process.env.LOCALAPPDATA||os.homedir(),'SuperVoiceAgent');
const SECRET_FILE=path.join(RUNTIME,'bridge-secret.json');
const ALLOWED_ORIGINS=new Set([
  'https://alanshahd82-dotcom.github.io',
  'http://127.0.0.1:8788',
  'http://localhost:8788'
]);
const MAX_BODY=900000;
const DEFAULT_CONTEXT=[
  'voice-chat/PROJECT_CONTEXT.md',
  'voice-chat/index.html',
  'voice-chat/app.js',
  'voice-chat/agent.js',
  'voice-chat/manifest.webmanifest',
  'voice-chat/sw.js'
];

await fsp.mkdir(RUNTIME,{recursive:true});
let secret=await loadOrCreateSecret();
let pairCode=String(crypto.randomInt(100000,1000000));
let pairExpires=Date.now()+15*60*1000;
let pairAttempts=0;

async function loadOrCreateSecret(){
  try{
    const data=JSON.parse(await fsp.readFile(SECRET_FILE,'utf8'));
    if(data.token) return data;
  }catch{}
  const data={token:crypto.randomBytes(32).toString('base64url'),createdAt:new Date().toISOString()};
  await fsp.writeFile(SECRET_FILE,JSON.stringify(data,null,2),'utf8');
  return data;
}function json(res,status,obj,origin){
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'
  };
  if(origin&&ALLOWED_ORIGINS.has(origin)){
    headers['access-control-allow-origin']=origin;
    headers['vary']='Origin';
  }
  res.writeHead(status,headers);
  res.end(JSON.stringify(obj));
}

function corsPreflight(req,res,origin){
  if(!origin||!ALLOWED_ORIGINS.has(origin)){
    json(res,403,{error:'origin_not_allowed'});
    return;
  }
  res.writeHead(204,{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'authorization,content-type',
    'access-control-max-age':'600',
    'vary':'Origin'
  });
  res.end();
}

async function readJson(req){
  let size=0;
  const parts=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BODY) throw new Error('request_too_large');
    parts.push(chunk);
  }
  const raw=Buffer.concat(parts).toString('utf8');
  return raw?JSON.parse(raw):{};
}

function authorized(req){
  const h=String(req.headers.authorization||'');
  if(!h.startsWith('Bearer ')) return false;
  const candidate=h.slice(7);
  const a=Buffer.from(candidate);
  const b=Buffer.from(secret.token);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}function safeRepoPath(rel){
  rel=String(rel||'').replace(/\\/g,'/').replace(/^\/+/, '');
  if(!rel||rel.includes('\0')) throw new Error('invalid_path');
  const norm=path.posix.normalize(rel);
  if(norm.startsWith('../')||norm==='..') throw new Error('invalid_path');
  if(norm.startsWith('.git/')||norm==='.git') throw new Error('protected_path');
  if(/(^|\/)(\.env|.*secret.*|.*credential.*|.*token.*)$/i.test(norm)) throw new Error('protected_path');
  if(!norm.startsWith('voice-chat/')) throw new Error('path_outside_voice_chat');
  return norm;
}

async function git(args,opts={}){
  const {stdout='',stderr=''}=await execFileAsync('git',args,{
    cwd:REPO,
    windowsHide:true,
    maxBuffer:4*1024*1024,
    ...opts
  });
  return {stdout:stdout.trim(),stderr:stderr.trim()};
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForPagesDeployment(publishId,timeoutMs=75000){
  const start=Date.now();
  const url='https://alanshahd82-dotcom.github.io/Super/voice-chat/deploy-state.json';
  while(Date.now()-start<timeoutMs){
    try{
      const r=await fetch(url+'?publish='+encodeURIComponent(publishId)+'&t='+Date.now(),{
        cache:'no-store',
        headers:{'user-agent':'SuperVoiceAgent/1.0'}
      });
      if(r.ok){
        const data=await r.json();
        if(data.publish_id===publishId){
          return {deployed:true,wait_ms:Date.now()-start};
        }
      }
    }catch{}
    await sleep(4000);
  }
  return {deployed:false,wait_ms:Date.now()-start};
}

async function getContext(paths){
  const requested=Array.isArray(paths)&&paths.length?paths:DEFAULT_CONTEXT;
  const files=[];
  let total=0;
  for(const item of requested.slice(0,10)){
    const rel=safeRepoPath(item);
    const full=path.join(REPO,...rel.split('/'));
    let stat;
    try{stat=await fsp.stat(full);}catch{files.push({path:rel,missing:true});continue;}
    if(!stat.isFile()){files.push({path:rel,error:'not_file'});continue;}
    if(stat.size>180000){files.push({path:rel,error:'too_large',size:stat.size});continue;}
    const content=await fsp.readFile(full,'utf8');
    total+=content.length;
    if(total>600000) break;
    files.push({path:rel,content});
  }
  const {stdout:head}=await git(['rev-parse','HEAD']);
  return {head,files};
}

const TEXT_EXT=/\.(?:html?|css|js|mjs|cjs|json|md|txt|webmanifest|svg)$/i;

async function listRepoFiles(){
  const root=path.join(REPO,'voice-chat');
  const files=[];
  async function walk(dir){
    for(const entry of await fsp.readdir(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      const rel=path.relative(REPO,full).replace(/\\/g,'/');
      if(entry.isDirectory()){
        if(files.length<400) await walk(full);
        continue;
      }
      if(!entry.isFile()) continue;
      const stat=await fsp.stat(full);
      files.push({path:rel,size:stat.size,text:TEXT_EXT.test(rel)});
      if(files.length>=400) return;
    }
  }
  await walk(root);
  const {stdout:head}=await git(['rev-parse','HEAD']);
  return {head,files};
}

async function searchRepo(query,paths){
  const q=String(query||'').trim();
  if(!q||q.length>120) throw new Error('invalid_search_query');
  const needle=q.toLowerCase();
  const candidates=Array.isArray(paths)&&paths.length
    ? paths.slice(0,20).map(safeRepoPath)
    : (await listRepoFiles()).files.filter(x=>x.text&&x.size<=180000).map(x=>x.path);
  const matches=[];
  for(const rel of candidates){
    if(matches.length>=30) break;
    const full=path.join(REPO,...rel.split('/'));
    let content;
    try{content=await fsp.readFile(full,'utf8');}catch{continue;}
    const lines=content.split(/\r?\n/);
    for(let i=0;i<lines.length&&matches.length<30;i++){
      const idx=lines[i].toLowerCase().indexOf(needle);
      if(idx>=0){
        matches.push({
          path:rel,
          line:i+1,
          excerpt:lines[i].slice(Math.max(0,idx-100),idx+needle.length+180)
        });
      }
    }
  }
  const {stdout:head}=await git(['rev-parse','HEAD']);
  return {head,query:q,matches};
}async function validateFile(rel){
  const full=path.join(REPO,...rel.split('/'));
  if(/\.(m?js|cjs)$/i.test(rel)){
    await execFileAsync(process.execPath,['--check',full],{cwd:REPO,windowsHide:true,maxBuffer:1024*1024});
  }
  if(/\.json$/i.test(rel)||/manifest\.webmanifest$/i.test(rel)){
    JSON.parse(await fsp.readFile(full,'utf8'));
  }
}

const SECRET_PATTERNS=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bsk-[A-Za-z0-9_-]{24,}\b/
];

async function validateProject(touched){
  const root=path.join(REPO,'voice-chat');
  const required=[
    'index.html',
    'app.js',
    'agent.js',
    'bridge.js',
    'manifest.webmanifest',
    'sw.js',
    'PROJECT_CONTEXT.md'
  ];

  for(const name of required){
    const full=path.join(root,name);
    const stat=await fsp.stat(full).catch(()=>null);
    if(!stat?.isFile()) throw new Error('required_file_missing: voice-chat/'+name);
  }

  const index=await fsp.readFile(path.join(root,'index.html'),'utf8');
  if(!/rel=["']manifest["']/i.test(index)) throw new Error('pwa_manifest_link_missing');
  if(!/app\.js/i.test(index)) throw new Error('app_script_missing');

  const manifest=JSON.parse(await fsp.readFile(path.join(root,'manifest.webmanifest'),'utf8'));
  if(manifest.display!=='standalone') throw new Error('manifest_display_must_be_standalone');
  if(!Array.isArray(manifest.icons)||manifest.icons.length<2) throw new Error('manifest_icons_missing');
  for(const icon of manifest.icons){
    const src=String(icon.src||'').replace(/^\.\//,'');
    if(!src) throw new Error('manifest_icon_invalid');
    const stat=await fsp.stat(path.join(root,src)).catch(()=>null);
    if(!stat?.isFile()) throw new Error('manifest_icon_missing: '+src);
  }

  for(const rel of touched){
    if(!TEXT_EXT.test(rel)) continue;
    const content=await fsp.readFile(path.join(REPO,...rel.split('/')),'utf8').catch(()=>null);
    if(content===null) continue;
    for(const pattern of SECRET_PATTERNS){
      if(pattern.test(content)) throw new Error('possible_secret_detected: '+rel);
    }
  }
}

async function applyFiles(body){
  const files=Array.isArray(body.files)?body.files:[];
  const edits=Array.isArray(body.edits)?body.edits:[];
  if((!files.length&&!edits.length)||files.length+edits.length>16) throw new Error('invalid_changes');

  const {stdout:currentHead}=await git(['rev-parse','HEAD']);
  const expectedHead=String(body.expected_head||'').trim();
  if(!expectedHead) throw new Error('context_required');
  if(expectedHead!==currentHead) throw new Error('repository_changed');

  const dirty=(await git(['status','--porcelain'])).stdout;
  if(dirty) throw new Error('working_tree_not_clean');

  const backupMap=new Map();
  const touched=[];
  let committed=false;
  const backup=async(rel)=>{
    if(backupMap.has(rel)) return;
    const full=path.join(REPO,...rel.split('/'));
    try{backupMap.set(rel,{full,previous:await fsp.readFile(full),existed:true});}
    catch{backupMap.set(rel,{full,previous:null,existed:false});}
  };

  try{
    for(const item of files){
      const rel=safeRepoPath(item.path);
      if(typeof item.content!=='string'||item.content.length>220000) throw new Error('invalid_content');
      await backup(rel);
      const full=path.join(REPO,...rel.split('/'));
      await fsp.mkdir(path.dirname(full),{recursive:true});
      await fsp.writeFile(full,item.content,'utf8');
      touched.push(rel);
    }

    for(const item of edits){
      const rel=safeRepoPath(item.path);
      if(typeof item.old!=='string'||typeof item.new!=='string') throw new Error('invalid_edit');
      if(item.old.length>160000||item.new.length>160000) throw new Error('edit_too_large');
      await backup(rel);
      const full=path.join(REPO,...rel.split('/'));
      let current;
      try{current=await fsp.readFile(full,'utf8');}catch{throw new Error('edit_file_missing: '+rel);}
      const first=current.indexOf(item.old);
      if(first<0) throw new Error('edit_match_missing: '+rel);
      if(current.indexOf(item.old,first+Math.max(1,item.old.length))>=0) throw new Error('edit_match_not_unique: '+rel);
      await fsp.writeFile(full,current.slice(0,first)+item.new+current.slice(first+item.old.length),'utf8');
      touched.push(rel);
    }

    const unique=[...new Set(touched)];
    for(const rel of unique) await validateFile(rel);
    await validateProject(unique);
    await git(['diff','--check']);
    await git(['add','--',...unique]);
    const staged=(await git(['diff','--cached','--name-only'])).stdout;
    if(!staged){
      await git(['reset']);
      return {ok:true,no_changes:true};
    }

    const msg=('Agent: '+String(body.message||'self update')).replace(/[\r\n]+/g,' ').slice(0,120);
    const publishId=crypto.randomBytes(12).toString('hex');

    const deployRel='voice-chat/deploy-state.json';
    await backup(deployRel);
    const deployFull=path.join(REPO,...deployRel.split('/'));
    await fsp.writeFile(deployFull,JSON.stringify({
      publish_id:publishId,
      requested_at:new Date().toISOString(),
      message:msg.replace(/^Agent:\s*/,''),
      files:unique,
      base:currentHead
    },null,2)+'\n','utf8');
    await git(['add','--',deployRel]);

    const historyRel='voice-chat/AGENT_HISTORY.jsonl';
    await backup(historyRel);
    const historyFull=path.join(REPO,...historyRel.split('/'));
    const historyEntry={
      at:new Date().toISOString(),
      publish_id:publishId,
      message:msg.replace(/^Agent:\s*/,''),
      files:unique,
      base:currentHead
    };
    await fsp.appendFile(historyFull,JSON.stringify(historyEntry)+'\n','utf8');
    await git(['add','--',historyRel]);

    await git(['commit','-m',msg]);
    committed=true;
    const {stdout:sha}=await git(['rev-parse','HEAD']);
    try{
      await git(['push','origin','HEAD:main'],{timeout:45000});
    }catch(pushError){
      throw new Error('push_failed: '+(pushError.stderr||pushError.message));
    }

    const deployment=await waitForPagesDeployment(publishId);
    return {
      ok:true,
      commit:sha,
      files:unique,
      publish_id:publishId,
      deployed:deployment.deployed,
      deploy_wait_ms:deployment.wait_ms,
      live_url:'https://alanshahd82-dotcom.github.io/Super/voice-chat/?commit='+sha.slice(0,12)
    };
  }catch(err){
    try{
      if(committed){
        await git(['reset','--hard',currentHead]);
        for(const b of backupMap.values()){
          if(!b.existed) await fsp.rm(b.full,{force:true});
        }
      }else{
        await git(['reset']);
        for(const b of backupMap.values()){
          if(b.existed) await fsp.writeFile(b.full,b.previous);
          else await fsp.rm(b.full,{force:true});
        }
      }
    }catch{}
    throw err;
  }
}const server=http.createServer(async(req,res)=>{
  const origin=String(req.headers.origin||'');
  if(req.method==='OPTIONS'){
    corsPreflight(req,res,origin);
    return;
  }

  if(origin&&!ALLOWED_ORIGINS.has(origin)){
    json(res,403,{error:'origin_not_allowed'});
    return;
  }

  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='GET'&&url.pathname==='/health'){
      json(res,200,{ok:true,service:'super-agent-bridge',pairing:true},origin);
      return;
    }

    if(req.method==='POST'&&url.pathname==='/pair'){
      const body=await readJson(req);
      pairAttempts++;
      if(pairAttempts>12) throw new Error('pairing_locked');
      if(Date.now()>pairExpires) throw new Error('pairing_expired');
      if(String(body.code||'')!==pairCode) throw new Error('pairing_code_invalid');
      pairCode=String(crypto.randomInt(100000,1000000));
      pairExpires=Date.now()+15*60*1000;
      pairAttempts=0;
      json(res,200,{ok:true,token:secret.token},origin);
      return;
    }

    if(!authorized(req)){
      json(res,401,{error:'unauthorized'},origin);
      return;
    }

    if(req.method==='POST'&&url.pathname==='/api/context'){
      const body=await readJson(req);
      json(res,200,{ok:true,...await getContext(body.paths)},origin);
      return;
    }

    if(req.method==='GET'&&url.pathname==='/api/tree'){
      json(res,200,{ok:true,...await listRepoFiles()},origin);
      return;
    }

    if(req.method==='POST'&&url.pathname==='/api/search'){
      const body=await readJson(req);
      json(res,200,{ok:true,...await searchRepo(body.query,body.paths)},origin);
      return;
    }

    if(req.method==='POST'&&url.pathname==='/api/apply'){
      const body=await readJson(req);
      json(res,200,await applyFiles(body),origin);
      return;
    }

    if(req.method==='GET'&&url.pathname==='/api/status'){
      const head=(await git(['rev-parse','HEAD'])).stdout;
      const dirty=(await git(['status','--porcelain'])).stdout;
      json(res,200,{ok:true,head,clean:!dirty},origin);
      return;
    }

    json(res,404,{error:'not_found'},origin);
  }catch(err){
    json(res,400,{error:err?.message||String(err)},origin);
  }
});

server.listen(PORT,'127.0.0.1',()=>{
  console.log('SUPER_AGENT_BRIDGE_READY http://127.0.0.1:'+PORT);
  console.log('PAIR_CODE '+pairCode);
  console.log('PAIR_EXPIRES '+new Date(pairExpires).toISOString());
  console.log('REPO '+REPO);
});