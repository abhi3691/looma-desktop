// Isolated live app session used only to capture public demo footage.
const {app,BrowserWindow,Menu}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const home=fs.mkdtempSync('/private/tmp/looma-recording-');
app.setPath('userData',home);app.setAppPath(path.join(__dirname,'..'));
execFileSync('/usr/bin/say',['-v','Samantha','-o',path.join(home,'wake.aiff'),'Hi Looma.']);
execFileSync('/usr/bin/afconvert',['-f','WAVE','-d','LEI16@16000','-c','1',path.join(home,'wake.aiff'),path.join(home,'wake.wav')]);
const raw=fs.readFileSync(path.join(home,'wake.wav'));let pcm;
for(let i=12;i+8<=raw.length;){const n=raw.readUInt32LE(i+4);if(raw.toString('ascii',i,i+4)==='data'){pcm=raw.subarray(i+8,i+8+n);break;}i+=8+n+(n%2);}
const samples=Buffer.concat([Buffer.alloc(16000*2*5),pcm,Buffer.alloc(16000*2*100)]),header=Buffer.alloc(44);
header.write('RIFF');header.writeUInt32LE(36+samples.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(samples.length,40);
const capture=path.join(home,'microphone.wav');fs.writeFileSync(capture,Buffer.concat([header,samples]));
app.commandLine.appendSwitch('no-sandbox'); // This isolated demo needs Chromium to read its audio fixture.
app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-audio-capture',capture);
require('../dist/main.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const output=path.join(__dirname,'../../../social-demo');
app.whenReady().then(async()=>{
 let workspace,pet;
 for(let i=0;i<200;i++){const windows=BrowserWindow.getAllWindows();workspace=windows.find(w=>w.webContents.getURL().startsWith('http://127.0.0.1'));pet=windows.find(w=>w.getBounds().width===240);if(workspace&&!workspace.webContents.isLoading())break;await wait(100);}
 workspace.setBounds({x:30,y:70,width:1100,height:730});workspace.show();workspace.focus();pet.setPosition(875,525);pet.show();pet.setAlwaysOnTop(true);
 fs.writeFileSync(path.join(output,'capture-region.json'),JSON.stringify(workspace.getBounds()));
 console.log('Ready for desktop recording');
 while(!fs.existsSync(path.join(output,'record-start')))await wait(100);
 const evaluate=s=>pet.webContents.executeJavaScript(s);
 const s=await evaluate('window.careless.snapshot()');
 await evaluate(`window.careless.settings({...${JSON.stringify(s.settings)},voiceInput:true,wakeWord:true,voiceOutput:true,speechProvider:'edge',cartoonVoice:true,language:'en'})`);
 await wait(17000);
 fs.writeFileSync(capture,Buffer.concat([header,Buffer.alloc(samples.length)]));
 await evaluate('window.careless.chat("Looma, stretch")');
 await wait(7000);
 Menu.getApplicationMenu().items[0].submenu.items.find(x=>x.label==='Settings').click();
 await wait(5000);
 await workspace.webContents.executeJavaScript(`document.querySelector('[title="Close App Settings"]')?.click()`);
 await wait(8000);
 app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
setTimeout(()=>app.quit(),90000);
app.on('will-quit',()=>{try{fs.rmSync(home,{recursive:true,force:true});}catch{}});
