import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalRuntime} from '../src/runtime';
test('fresh installations find packaged recognition and wake models without a user download',()=>{
 const dir=mkdtempSync(join(tmpdir(),'looma-bundled-'));
 try{
  const resources=join(dir,'resources');mkdirSync(join(resources,'speech-models'),{recursive:true});
  for(const name of ['ggml-small.bin','ggml-tiny.en.bin'])writeFileSync(join(resources,'speech-models',name),'fixture');
  const runtime=new LocalRuntime(dir,dir,resources);
  assert.equal(runtime.speechModel(),join(resources,'speech-models','ggml-small.bin'));
  assert.equal(runtime.wakeModel(),join(resources,'speech-models','ggml-tiny.en.bin'));
  assert.equal(runtime.status.speechModelAvailable,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
