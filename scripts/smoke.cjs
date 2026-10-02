const {app,BrowserWindow,Menu}=require('electron');
const {mkdtempSync,rmSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const home=mkdtempSync(join(tmpdir(),'looma-ui-test-'));
app.setPath('userData',home);app.setAppPath(join(__dirname,'..'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=setTimeout(()=>{console.error('UI test timed out');app.quit();},60000);
require('../dist/main.cjs');
app.whenReady().then(async()=>{try{
 let pet,workspace;
 for(let i=0;i<200;i++){
  const windows=BrowserWindow.getAllWindows();
  pet=windows.find(w=>w.getBounds().width===240);
  workspace=windows.find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));
  if(workspace&&!workspace.webContents.isLoading())break;
  await wait(150);
 }
 assert(pet&&workspace,'Only the puppy and new workspace must start');
 assert.equal(BrowserWindow.getAllWindows().length,2);
 assert(BrowserWindow.getAllWindows().every(w=>!w.webContents.getURL().endsWith('/dist/index.html')),'Legacy dashboard must not exist');
 await wait(700);
 const evalPet=s=>pet.webContents.executeJavaScript(s),evalWeb=s=>workspace.webContents.executeJavaScript(s);
 assert.equal(await evalPet('document.querySelectorAll("button").length'),0);
 assert.equal(await evalPet('typeof require'),'undefined');
 assert.equal(await evalWeb(`Boolean(document.querySelector('[title="Toggle Desktop Screen Preview"]'))`),false);
 const settingsItem=Menu.getApplicationMenu().items[0].submenu.items.find(x=>x.label==='Settings');settingsItem.click();
 for(let i=0;i<40;i++){if(await evalWeb(`!!document.querySelector('[aria-label="Voice companion settings"]')`))break;await wait(100);}
 assert.match(await evalWeb('document.body.innerText'),/Talk to Looma/);
 assert.match(await evalWeb('document.body.innerText'),/Restart listening/);
 const snapshot=await evalPet('window.careless.snapshot()');
 assert.equal(snapshot.settings.voiceInput,false);
 const response=await evalWeb(`fetch('/api/v1/desktop/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'settings',value:{microphoneId:'test-mic',wakeWord:false}})}).then(r=>r.status)`);
 assert.equal(response,200);
 await evalWeb(`fetch('/api/v1/desktop/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'settings',value:{voiceOutput:true}})})`);
 await evalWeb(`fetch('/api/v1/desktop/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'settings',value:{language:'ml'}})})`);
 assert.equal((await evalPet('window.careless.snapshot()')).settings.voiceOutput,true,'Changing language must not disable spoken replies');
 assert.equal((await evalPet('window.careless.snapshot()')).settings.microphoneId,'test-mic');
 assert.equal(await evalWeb(`fetch('/api/v1/desktop/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'settings',value:{arbitrary:true}})}).then(r=>r.status)`),400);
 await evalWeb(`fetch('/api/v1/desktop/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'settings',value:{voiceInput:true,wakeWord:false}})})`);
 await evalPet(`window.careless.voice({action:'remember',question:'Hi Looma',text:'Hello! I’m listening. What would you like to know?'})`);
 await evalWeb(`document.querySelector('[title="Close App Settings"]')?.click()`);
 for(let i=0;i<40;i++){if((await evalWeb('document.body.innerText')).includes('Hello! I’m listening.'))break;await wait(100);}
 assert.match(await evalWeb('document.body.innerText'),/Hello! I’m listening\./,'Voice greeting must appear without a focus change');
 await evalPet('window.careless.chat("Looma, sit down")');
 writeFileSync(join(__dirname,'../chat-demo-preview.png'),(await workspace.webContents.capturePage()).toPNG());
 const frame=await pet.webContents.capturePage();assert.equal(frame.toBitmap()[3],0);
 writeFileSync(join(__dirname,'../pet-preview.png'),frame.toPNG());
 writeFileSync(join(__dirname,'../voice-settings-preview.png'),(await workspace.webContents.capturePage()).toPNG());
 workspace.hide();await evalPet('document.querySelector("#petCharacter").dispatchEvent(new MouseEvent("dblclick"))');await wait(200);assert(workspace.isVisible());
 console.log('PASS: new workspace only, no computer demo, voice controls, validated settings bridge, transparent puppy and double-click.');
 clearTimeout(deadline);app.quit();
}catch(e){console.error(e);process.exitCode=1;clearTimeout(deadline);app.quit();}});
app.on('will-quit',()=>{try{rmSync(home,{recursive:true,force:true});}catch{}});
