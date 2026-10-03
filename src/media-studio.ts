import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
type Job={id:string;kind:'image'|'video';prompt:string;status:string;error?:string;file?:string;operation?:string};
const base='https://generativelanguage.googleapis.com/v1beta';
export class MediaStudio{
 private timer?:ReturnType<typeof setInterval>;
 private jobs:Job[]=[];private running=new Set<string>();
 constructor(private dir:string,private key:()=>string){mkdirSync(dir,{recursive:true});try{this.jobs=JSON.parse(readFileSync(join(dir,'jobs.json'),'utf8'));for(const j of this.jobs)if(j.status==='Generating'&&!j.operation){j.status='Failed';j.error='Generation was interrupted before an operation was saved.';}}catch{}this.timer=setInterval(()=>{for(const j of this.jobs.filter(j=>j.status==='Generating'&&j.operation))void this.manage({action:'poll',id:j.id});},10000);this.timer.unref();}
 stop(){if(this.timer)clearInterval(this.timer);}
 private save(){writeFileSync(join(this.dir,'jobs.json'),JSON.stringify(this.jobs),{mode:0o600});}
 private async api(path:string,body?:unknown){const key=this.key();if(!key)throw Error('Add a Google Gemini API key in AI providers. Image and video generation require provider access and may be billed.');const r=await fetch(base+'/'+path,{method:body?'POST':'GET',redirect:'error',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Google media request failed (${r.status}). Check model access, billing, and quota.`);return r.json() as Promise<any>;}
 async manage(raw:unknown){const v=z.object({action:z.enum(['list','create','poll']),kind:z.enum(['image','video']).optional(),prompt:z.string().trim().min(1).max(3000).optional(),id:z.string().uuid().optional(),portrait:z.boolean().optional()}).strict().parse(raw);
  if(v.action==='create'){if(!v.kind||!v.prompt)throw Error('Choose image or video and describe it.');if(!this.key())throw Error('Add a Google Gemini key in AI providers first.');if(this.jobs.filter(j=>j.status==='Generating').length>=2)throw Error('Two creations are already running.');const job:Job={id:randomUUID(),kind:v.kind,prompt:v.prompt,status:'Generating'};this.jobs.unshift(job);this.save();this.running.add(job.id);void this.generate(job,!!v.portrait).catch(e=>{job.status='Failed';job.error=e.message;this.save();}).finally(()=>this.running.delete(job.id));}
  if(v.action==='poll'&&v.id){const j=this.jobs.find(j=>j.id===v.id);if(j?.operation && j.status==='Generating'&&!this.running.has(j.id)){this.running.add(j.id);void this.finishVideo(j).catch(e=>{j.status='Failed';j.error=e.message;this.save();}).finally(()=>this.running.delete(j.id));}}
  return this.jobs.map(({operation,...j})=>({...j,url:j.file?'/api/v1/creations/'+j.file:undefined}));
 }
 private async generate(j:Job,portrait:boolean){
  if(j.kind==='image'){const result=await this.api('models/gemini-3.1-flash-image-preview:generateContent',{contents:[{parts:[{text:j.prompt}]}],generationConfig:{responseModalities:['IMAGE']}});const part=result.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData);if(!part)throw Error('No image returned. The prompt may be blocked or the model unavailable.');const type=part.inlineData.mimeType;if(!['image/png','image/jpeg','image/webp'].includes(type))throw Error('Unsupported generated image format.');const bytes=Buffer.from(part.inlineData.data,'base64');if(bytes.length>32*1024*1024)throw Error('Generated image exceeds size limit.');j.file=j.id+(type==='image/png'?'.png':type==='image/jpeg'?'.jpg':'.webp');writeFileSync(join(this.dir,j.file),bytes,{mode:0o600});j.status='Ready';this.save();return;}
  const result=await this.api('models/veo-3.1-fast-generate-preview:predictLongRunning',{instances:[{prompt:j.prompt}],parameters:{aspectRatio:portrait?'9:16':'16:9',durationSeconds:8,resolution:'720p'}});
  if(!/^models\/[a-z0-9.-]+\/operations\/[A-Za-z0-9_-]+$/.test(result.name||''))throw Error('Invalid video operation returned.');j.operation=result.name;this.save();
 }
 private async finishVideo(j:Job){if(!/^models\/[a-z0-9.-]+\/operations\/[A-Za-z0-9_-]+$/.test(j.operation||''))throw Error('Invalid saved operation.');const result=await this.api(j.operation!);if(!result.done)return;if(result.error)throw Error('Video generation failed. Check your prompt and provider quota.');const uri=result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;if(!uri)throw Error('No video returned. The prompt may be blocked.');let url=new URL(uri);if(url.protocol!=='https:'||url.hostname!=='generativelanguage.googleapis.com')throw Error('Untrusted video download location.');let r=await fetch(url,{headers:{'x-goog-api-key':this.key()},redirect:'manual',signal:AbortSignal.timeout(120000)});
  if([301,302,303,307,308].includes(r.status)){url=new URL(r.headers.get('location')||'',url);if(url.protocol!=='https:'||!(url.hostname==='storage.googleapis.com'||url.hostname.endsWith('.googleusercontent.com')))throw Error('Untrusted video redirect.');r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(120000)});}
  if(!r.ok||!r.body)throw Error('Video download failed.');const chunks:Uint8Array[]=[];let total=0;for await(const chunk of r.body as any){total+=chunk.length;if(total>100*1024*1024)throw Error('Video exceeds the 100 MB download limit.');chunks.push(chunk);}j.file=j.id+'.mp4';writeFileSync(join(this.dir,j.file),Buffer.concat(chunks),{mode:0o600});j.status='Ready';this.save();
 }
}
