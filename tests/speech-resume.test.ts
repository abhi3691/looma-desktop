import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceController} from '../src/voice-ui';
import {voiceControl} from '../src/voice-control';
import {defaults} from '../src/shared';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function settle(){await tick();await tick();}
function browser(local=false){
 const saved={window:globalThis.window,Audio:globalThis.Audio,speechSynthesis:globalThis.speechSynthesis,SpeechSynthesisUtterance:globalThis.SpeechSynthesisUtterance,revoke:URL.revokeObjectURL};
 const clips:any[]=[],utterances:any[]=[],calls:any[]=[],notices:string[]=[],revoked:string[]=[];
 let state='Idle',metadataReady=true;
 const settings={...defaults,voiceOutput:true,speechProvider:local?'offline' as const:'edge' as const};
 class AudioMock {
  currentTime=0;duration=60;readyState=metadataReady?1:0;preload='';plays=0;paused=false;
  onended?:()=>void;onerror?:()=>void;handlers=new Map<string,()=>void>();
  constructor(readonly src:string){clips.push(this);}
  async play(){this.plays++;this.paused=false;}pause(){this.paused=true;}
  addEventListener(name:string,fn:()=>void){this.handlers.set(name,fn);}
 }
 class UtteranceMock{constructor(readonly text:string){}}
 Object.assign(globalThis,{
  Audio:AudioMock,SpeechSynthesisUtterance:UtteranceMock,
  speechSynthesis:{getVoices:()=>local?[{name:'Samantha',voiceURI:'local',lang:'en-US',localService:true}]:[],cancel:()=>{},speak:(u:any)=>{utterances.push(u);u.onstart?.();}},
  window:{careless:{state:async(s:string)=>{state=s;},snapshot:async()=>({settings,state,resting:false}),voice:async(body:any)=>{calls.push(body);return new Uint8Array([1,2,3]);}}}
 });
 URL.revokeObjectURL=(url:string)=>{revoked.push(url);saved.revoke(url);};
 const controller=new VoiceController(async(text)=>{calls.push({transcript:text});},text=>notices.push(text),()=>{});
 return {controller,settings,clips,utterances,calls,notices,revoked,setMetadata:(ready:boolean)=>{metadataReady=ready;},restore:()=>{controller.stopWake();Object.assign(globalThis,{window:saved.window,Audio:saved.Audio,speechSynthesis:saved.speechSynthesis,SpeechSynthesisUtterance:saved.SpeechSynthesisUtterance});URL.revokeObjectURL=saved.revoke;}};
}
test('continue seeks cached neural speech after repeated interruptions without another answer',async()=>{
 const b=browser();try{
  const first=b.controller.speak('Here is the original answer.',b.settings);await settle();
  b.clips[0].currentTime=4.25;b.controller.pauseSpeech();await first;
  assert.equal(b.revoked.length,0,'Paused audio must remain available');
  const second=b.controller.resumeSpeech();await settle();assert.equal(b.clips[1].src,b.clips[0].src);assert.equal(b.clips[1].currentTime,4.25);
  b.clips[1].currentTime=8.5;b.controller.pauseSpeech();await second;
  const third=b.controller.resumeSpeech();await settle();assert.equal(b.clips[2].currentTime,8.5);
  b.clips[2].onended();assert.equal(await third,true);
  assert.equal(b.calls.filter(c=>c.action==='synthesize').length,1);assert.equal(b.calls.filter(c=>c.transcript).length,0);assert.equal(b.revoked.length,1);
 }finally{b.restore();}
});
test('local voice resumes at the current word in the second sentence',async()=>{
 const b=browser(true);try{
  const first=b.controller.speak('First sentence. Second sentence.',b.settings);await settle();
  b.utterances[0].onend();await settle();assert.equal(b.utterances[1].text,'Second sentence.');
  b.utterances[1].onboundary({charIndex:7});b.controller.pauseSpeech();await first;
  const resumed=b.controller.resumeSpeech();await settle();assert.equal(b.utterances[2].text,'sentence.');b.utterances[2].onend();await resumed;
  assert.equal(b.calls.length,0);
 }finally{b.restore();}
});
test('mute discards paused speech, and continue without a bookmark stays local',async()=>{
 const b=browser();try{
  const first=b.controller.speak('An answer.',b.settings);await settle();b.controller.pauseSpeech();await first;b.controller.stopWake();await settle();
  assert.equal(await b.controller.resumeSpeech(),false);assert.equal(b.revoked.length,1);assert.equal(b.clips.length,1);assert.match(b.notices.at(-1)!,/no paused reply/);
 }finally{b.restore();}
});
test('a cancelled metadata wait cannot restart playback or lose the bookmark',async()=>{
 const b=browser();try{
  const first=b.controller.speak('An answer.',b.settings);await settle();b.clips[0].currentTime=6;b.controller.pauseSpeech();await first;
  b.setMetadata(false);const second=b.controller.resumeSpeech();await settle();assert.equal(b.clips[1].plays,0);
  b.controller.pauseSpeech();await second;b.clips[1].handlers.get('loadedmetadata')();assert.equal(b.clips[1].plays,0);
  b.setMetadata(true);const third=b.controller.resumeSpeech();await settle();assert.equal(b.clips[2].currentTime,6);b.clips[2].onended();await third;
 }finally{b.restore();}
});
test('continue commands are exact controls in English and Malayalam',()=>{
 for(const phrase of ['continue','Looma, continue.','Hi Looma, resume speaking','തുടരൂ','go on'])assert.equal(voiceControl(phrase),'resume');
 for(const phrase of ['pause','hold on','one second'])assert.equal(voiceControl(phrase),'pause');
 assert.equal(voiceControl('continue with my task tomorrow'),undefined);
});
