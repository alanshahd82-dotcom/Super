const TOKEN_KEY='super-agent-bridge-token-v1';
let endpointCache=null;

export function hasBridgeToken(){
  return !!localStorage.getItem(TOKEN_KEY);
}

export function clearBridgeToken(){
  localStorage.removeItem(TOKEN_KEY);
}

export async function getBridgeEndpoint(force=false){
  if(endpointCache&&!force) return endpointCache;
  const r=await fetch('./bridge-endpoint.json?ts='+Date.now(),{cache:'no-store'});
  if(!r.ok) throw new Error('bridge_endpoint_unavailable');
  const data=await r.json();
  if(!data.url||!/^https:\/\//.test(data.url)) throw new Error('bridge_endpoint_invalid');
  endpointCache=data.url.replace(/\/$/,'');
  return endpointCache;
}

async function request(pathname,{method='GET',body,auth=false}={}){
  const endpoint=await getBridgeEndpoint();
  const headers={};
  if(body!==undefined) headers['content-type']='application/json';
  if(auth){
    const token=localStorage.getItem(TOKEN_KEY);
    if(!token) throw new Error('bridge_not_paired');
    headers.authorization='Bearer '+token;
  }
  const r=await fetch(endpoint+pathname,{
    method,
    headers,
    body:body===undefined?undefined:JSON.stringify(body),
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||('bridge_http_'+r.status));
  return data;
}export async function bridgeHealth(){
  try{
    const data=await request('/health');
    return {online:!!data.ok,paired:hasBridgeToken(),...data};
  }catch(error){
    return {online:false,paired:hasBridgeToken(),error:error?.message||String(error)};
  }
}

export async function pairBridge(code){
  const data=await request('/pair',{
    method:'POST',
    body:{code:String(code||'').trim()}
  });
  if(!data.token) throw new Error('pairing_failed');
  localStorage.setItem(TOKEN_KEY,data.token);
  return {ok:true};
}

export async function bridgeGenerate(messages,maxNewTokens=520,mode='chat'){
  return request('/api/generate',{
    method:'POST',
    auth:true,
    body:{
      messages:Array.isArray(messages)?messages:[],
      max_new_tokens:Number(maxNewTokens)||520,
      mode:mode==='dev'?'dev':'chat'
    }
  });
}

export async function bridgeContext(paths){
  return request('/api/context',{
    method:'POST',
    auth:true,
    body:{paths:Array.isArray(paths)?paths:[]}
  });
}

export async function bridgeTree(){
  return request('/api/tree',{auth:true});
}

export async function bridgeSearch(query,paths){
  return request('/api/search',{
    method:'POST',
    auth:true,
    body:{
      query:String(query||''),
      paths:Array.isArray(paths)?paths:[]
    }
  });
}

export async function bridgeApply(payload){
  return request('/api/apply',{
    method:'POST',
    auth:true,
    body:payload||{}
  });
}

export async function bridgeRollback(expectedHead){
  return request('/api/rollback',{
    method:'POST',
    auth:true,
    body:{expected_head:String(expectedHead||'')}
  });
}

export async function bridgeStatus(){
  return request('/api/status',{auth:true});
}