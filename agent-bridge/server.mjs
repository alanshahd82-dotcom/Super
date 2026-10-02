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
}async function validateFile(rel){
  const full=path.join(REPO,...rel.split('/'));
  if(/\.(m?js|cjs)$/i.test(rel)){
    await execFileAsync(process.execPath,['--check',full],{cwd:REPO,windowsHide:true,maxBuffer:1024*1024});
  }
  if(/\.json$/i.test(rel)||/manifest\.webmanifest$/i.test(rel)){
    JSON.parse(await fsp.readFile(full,'utf8'));
  }
}

async function applyFiles(body){
  const files=Array.isArray(body.files)?body.files:[];
  const edits=Array.isArray(body.edits)?body.edits:[];
  if((!files.length&&!edits.length)||files.length+edits.length>16) throw new Error('invalid_changes');
  const dirty=(await git(['status','--porcelain'])).stdout;
  if(dirty) throw new Error('working_tree_not_clean');

  const backupMap=new Map();
  const touched=[];
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
    await git(['diff','--check']);
    await git(['add','--',...unique]);
    const staged=(await git(['diff','--cached','--name-only'])).stdout;
    if(!staged){
      await git(['reset']);
      return {ok:true,no_changes:true};
    }

    const msg=('Agent: '+String(body.message||'self update')).replace(/[\r\n]+/g,' ').slice(0,120);
    await git(['commit','-m',msg]);
    const {stdout:sha}=await git(['rev-parse','HEAD']);
    try{
      await git(['push','origin','HEAD:main'],{timeout:45000});
    }catch(pushError){
      throw new Error('push_failed: '+(pushError.stderr||pushError.message));
    }
    return {
      ok:true,
      commit:sha,
      files:unique,
      live_url:'https://alanshahd82-dotcom.github.io/Super/voice-chat/?commit='+sha.slice(0,12)
    };
  }catch(err){
    try{
      await git(['reset']);
      for(const b of backupMap.values()){
        if(b.existed) await fsp.writeFile(b.full,b.previous);
        else await fsp.rm(b.full,{force:true});
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