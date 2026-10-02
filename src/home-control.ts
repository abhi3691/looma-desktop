import { z } from 'zod';
import { isIP } from 'node:net';
const entity = z.string().regex(/^(light|switch|climate|media_player|remote|scene|script)\.[a-z0-9_]+$/);
const binding = z.object({name:z.string().trim().min(1).max(80),entity,device:z.string().trim().max(100).default(''),commandOn:z.string().trim().max(100).default(''),commandOff:z.string().trim().max(100).default('')}).strict();
const configSchema=z.object({url:z.string().default(''),token:z.string().max(4096).default(''),enabled:z.boolean().default(false),bindings:z.array(binding).max(60).default([])}).strict();
export type HomeConfig=z.infer<typeof configSchema>;
export function localHomeURL(value:string){
 const url=new URL(value);const h=url.hostname.toLowerCase();
 const octets=h.split('.').map(Number);
 const lan=(isIP(h)===4&&(octets[0]===127||octets[0]===10||(octets[0]===192&&octets[1]===168)||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)))||h==='localhost'||h==='[::1]'||h.endsWith('.local')||h.endsWith('.home');
 if(!lan||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use your local Home Assistant address, such as http://192.168.1.20:8123');
 return url.origin;
}
export type HomeIntent={name:string;action:'on'|'off'|'activate'|'status';brightness?:number};
export function homeIntent(text:string):HomeIntent|undefined {
 const phrase=text.trim().replace(/^(?:(?:hi|hey)\s+)?(?:looma|luma)[,\s]+/i,'').replace(/[.!?]+$/,'').toLowerCase().replace(/^trun\b/, 'turn');
 let m=phrase.match(/^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(.+)$/);
 if(m)return {name:m[2],action:m[1] as 'on'|'off'};
 m=phrase.match(/^(?:turn|switch)\s+(?:the\s+)?(.+)\s+(on|off)$/);if(m)return {name:m[1],action:m[2] as 'on'|'off'};
 m=phrase.match(/^(?:activate|run)\s+(?:the\s+)?(.+)$/);if(m)return {name:m[1],action:'activate'};
 m=phrase.match(/^(?:set|dim)\s+(?:the\s+)?(.+?)\s+to\s+(\d{1,3})\s*(?:percent|%)$/);if(m&&Number(m[2])<=100)return {name:m[1],action:'on',brightness:Number(m[2])};
 m=phrase.match(/^(?:what is|what's|check)\s+(?:the\s+)?(.+?)\s+(?:status|state)$/);if(m)return {name:m[1],action:'status'};
 m=phrase.match(/^(.+?)\s+(ഓണാക്കൂ|ഓഫ് ആക്കൂ|ഓഫാക്കൂ)$/);if(m)return {name:m[1],action:m[2]==='ഓണാക്കൂ'?'on':'off'};
}
export class HomeControl {
 private config:HomeConfig;
 constructor(stored:unknown,private save:(config:HomeConfig)=>void,private requestFetch:typeof fetch=fetch){this.config=configSchema.parse(stored||{});}
 status(){return {url:this.config.url,enabled:this.config.enabled,configured:!!this.config.token,bindings:this.config.bindings};}
 configure(raw:unknown){
  const patch=configSchema.partial().parse(raw);if(patch.url)patch.url=localHomeURL(patch.url);
  const next={...this.config,...patch,token:patch.token||this.config.token};
  if(new Set(next.bindings.map(b=>b.name.toLowerCase())).size!==next.bindings.length)throw Error('Give each device a different spoken name');
  if(next.enabled&&(!next.url||!next.token))throw Error('Save a local address and access token first');
  this.save(next);this.config=next;return this.status();
 }
 private async request(path:string,body?:unknown){
  if(!this.config.url||!this.config.token)throw Error('Connect your local Home Assistant in Settings → Smart room');
  const url=localHomeURL(this.config.url);let response:Response;
  try{response=await this.requestFetch(url+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.config.token,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(10000),...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('Your local Home Assistant could not be reached');}
  if(!response.ok)throw Error(response.status===401?'Home Assistant rejected the access token':`Home Assistant could not complete that request (${response.status})`);
  return response.json();
 }
 async devices(){
  const raw=await this.request('/api/states');if(!Array.isArray(raw))throw Error('Home Assistant returned an unexpected response');
  return raw.filter(x=>entity.safeParse(x.entity_id).success).map(x=>({entity:x.entity_id,name:String(x.attributes?.friendly_name||x.entity_id),state:String(x.state)}));
 }
 async execute(intent:HomeIntent){
  if(!this.config.enabled)throw Error('Smart room control is off. Enable it in Settings after connecting your devices');
  const b=this.config.bindings.find(x=>x.name.toLowerCase()===intent.name.trim().toLowerCase());if(!b)throw Error(`No device named “${intent.name}” is configured. Add its spoken name in Smart room settings`);
  const domain=b.entity.split('.')[0];
  if(intent.action==='status'){const result=await this.request('/api/states/'+b.entity);return `${b.name}: ${String(result.state)}.`;}
  if(intent.brightness!==undefined&&domain!=='light')throw Error('Brightness applies to lights only');
  let service=intent.action==='off'?'turn_off':'turn_on';let body:Record<string,unknown>={entity_id:b.entity};
  if(domain==='remote'){
   const command=intent.action==='off'?b.commandOff:b.commandOn;if(!command||!b.device)throw Error('Set the learned Broadlink device and on/off commands in Smart room settings');
   service='send_command';body={...body,device:b.device,command};
  } else if(['scene','script'].includes(domain)&&intent.action==='off')throw Error('Scenes and routines can be activated; configure a separate off routine');
  if(intent.brightness!==undefined)body.brightness_pct=intent.brightness;
  await this.request(`/api/services/${domain}/${service}`,body);
  // An HTTP success acknowledges a service call; it does not prove IR delivery.
  return `Sent ${intent.brightness!==undefined?intent.brightness+' percent brightness':intent.action==='off'?'off':'on'} to ${b.name}.`;
 }
 async manage(raw:unknown){const v=z.object({action:z.enum(['status','save','devices','execute']),value:z.unknown().optional()}).strict().parse(raw);
  if(v.action==='status')return this.status();if(v.action==='save')return this.configure(v.value);if(v.action==='devices')return this.devices();
  return this.execute(z.object({name:z.string().max(80),action:z.enum(['on','off','activate','status']),brightness:z.number().min(0).max(100).optional()}).strict().parse(v.value));
 }
}
