import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

const MODEL='onnx-community/Qwen2.5-0.5B-Instruct';
let generator=null;
let device='wasm';

function progress(p){
  if(!p)return;
  if(p.status==='progress'&&typeof p.progress==='number'){
    postMessage({type:'status',text:'تنزيل النموذج… '+Math.round(p.progress)+'%'});
  }else if(p.status==='initiate'){
    postMessage({type:'status',text:'جاري تنزيل ملفات النموذج…'});
  }else if(p.status==='ready'){
    postMessage({type:'status',text:'جاري تشغيل النموذج…'});
  }
}

async function load(hasWebGPU){
  if(generator)return;
  if(hasWebGPU){
    try{
      postMessage({type:'status',text:'جاري التشغيل على GPU…'});
      generator=await pipeline('text-generation',MODEL,{
        device:'webgpu',
        dtype:'q4f16',
        progress_callback:progress
      });
      device='webgpu';
    }catch(e){
      generator=null;
    }
  }
  if(!generator){
    postMessage({type:'status',text:'جاري التشغيل على CPU…'});
    generator=await pipeline('text-generation',MODEL,{
      device:'wasm',
      dtype:'int8',
      progress_callback:progress
    });
    device='wasm';
  }
  postMessage({type:'ready',device});
}

self.onmessage=async({data})=>{
  try{
    if(data.type==='load'){
      await load(data.hasWebGPU);
      return;
    }
    if(data.type==='generate'){
      if(!generator)await load(false);
      const messages=(data.messages||[]).slice(-12);
      const out=await generator(messages,{
        max_new_tokens:192,
        do_sample:true,
        temperature:0.7,
        top_p:0.9,
        repetition_penalty:1.05
      });
      const generated=out?.[0]?.generated_text;
      let text='';
      if(Array.isArray(generated)) text=generated.at(-1)?.content||'';
      else text=String(generated||'');
      postMessage({type:'answer',text});
    }
  }catch(e){
    postMessage({type:'error',message:e?.message||String(e)});
  }
};