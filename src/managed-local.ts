import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {open,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const file='Qwen3-4B-Q4_K_M.gguf', size=2497280256, sha='7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5';
export class ManagedLocal {
  private child?:ChildProcess;private busy=false;private stopped=false;
  state={phase:'Stopped',progress:0,error:'',enabled:false};
  constructor(private dir:string,private resources:string){mkdirSync(dir,{recursive:true});try{this.state.enabled=!!JSON.parse(readFileSync(join(dir,'local-server.json'),'utf8')).enabled;}catch{}}
  private save(){writeFileSync(join(this.dir,'local-server.json'),JSON.stringify({enabled:this.state.enabled}),{mode:0o600});}
  enable(){this.state.enabled=true;this.save();return this.start();}
  async request(action:string){
    if(action==='stop'){this.state.enabled=false;this.save();this.stop();return this.state;}
    if(action==='start'){if(!this.busy)void this.enable().catch(e=>{this.state.phase='Failed';this.state.error=e.message;});}
    return {...this.state};
  }
  async start(){
    if(this.busy || this.child)return;this.busy=true;this.stopped=false;this.state.error='';
    try {
      const name=process.platform==='win32'?'llama-server.exe':'llama-server';
      const binary=[join(this.resources,'local-runtime',name),'/opt/homebrew/bin/llama-server','/usr/local/bin/llama-server',...(process.env.PATH||'').split(process.platform==='win32'?';':':').map(p=>join(p,name))].find(existsSync);
      if(!binary)throw Error('Install llama.cpp once to enable the built-in local server. Looma will manage it after installation.');
      const target=join(this.dir,file);
      if(!existsSync(target)){
        this.state.phase='Downloading Qwen 4B';this.state.progress=0;
        const response=await fetch('https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/'+file,{signal:AbortSignal.timeout(3600000)});
        if(!response.ok||!response.body)throw Error('Local model download failed. Try again.');
        const part=target+'.part',out=await open(part,'w',0o600),hash=createHash('sha256');let count=0;
        try{for await(const bytes of response.body as any){if(this.stopped)throw Error('Download cancelled.');count+=bytes.length;if(count>size)throw Error('Unexpected model size.');hash.update(bytes);await out.write(bytes);this.state.progress=Math.floor(count/size*100);}if(count!==size||hash.digest('hex')!==sha)throw Error('Model integrity check failed.');}catch(e){await rm(part,{force:true});throw e;}finally{await out.close();}
        await rename(part,target);
      }
      if(this.stopped)return;
      try {const occupied=await fetch('http://127.0.0.1:8080/health',{redirect:'error',signal:AbortSignal.timeout(800)});if(occupied.ok)throw Error('Port 8080 is already used by another local server. Stop it before starting Looma local AI.');}catch(e){if(e instanceof Error&&e.message.startsWith('Port 8080'))throw e;}
      this.state.phase='Starting local model';
      this.child=spawn(binary,['-m',target,'--host','127.0.0.1','--port','8080','--alias','looma-local-qwen4b','--jinja','-c','4096','-np','1','-ngl','99','--chat-template-kwargs','{"enable_thinking":false}'],{stdio:'ignore',windowsHide:true,env:{PATH:process.env.PATH,HOME:process.env.HOME,SYSTEMROOT:process.env.SYSTEMROOT}});
      let failure='';this.child.once('error',()=>{failure='Local server could not start.';});this.child.once('exit',()=>{this.child=undefined;if(!this.stopped){this.state.phase='Stopped';this.state.error='Local server stopped. Another application may be using port 8080.';}});
      for(let n=0;n<360;n++){if(failure)throw Error(failure);if(this.stopped)return;try{const r=await fetch('http://127.0.0.1:8080/health',{redirect:'error',signal:AbortSignal.timeout(1000)});if(r.ok){const models=await fetch('http://127.0.0.1:8080/v1/models',{redirect:'error',signal:AbortSignal.timeout(1000)});const data=await models.json() as any;if(!data.data?.some((m:any)=>m.id==='looma-local-qwen4b'))throw Error('Unexpected model on local server.');this.state.phase='Ready';this.state.progress=100;return;}}catch{}await new Promise(r=>setTimeout(r,500));}
      throw Error('Local model did not become ready. Check available memory or port 8080.');
    }finally{this.busy=false;}
  }
  stop(){this.stopped=true;this.child?.kill();this.child=undefined;this.state.phase='Stopped';}
}
