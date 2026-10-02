/** Import a licensed, self-contained rigged GLB after artist review.
 * node scripts/import-puppy-model.mjs /path/puppy.glb
 * Originals and licences remain the user's responsibility; this never downloads assets.
 */
import {readFile,writeFile} from 'node:fs/promises';
const path=process.argv[2];if(!path)throw Error('Supply a licensed rigged GLB file');
const bytes=await readFile(path);
if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2)throw Error('Expected GLB version 2');
const len=bytes.readUInt32LE(12);const doc=JSON.parse(bytes.toString('utf8',20,20+len));
if(!doc.skins?.length)throw Error('This model has no skeleton; it cannot independently animate body parts');
if(!doc.animations?.length)throw Error('This model has no animation clips');
if([...(doc.buffers||[]),...(doc.images||[])].some(x=>x.uri&&!x.uri.startsWith('data:')))throw Error('External resources must be embedded before import');
const names=doc.animations.map(a=>a.name||'');
const required=['Idle','Walking','Watching','Thinking','Warning','Talking','Happy','Sleeping'];
const missing=required.filter(x=>!names.includes(x));
if(missing.length)throw Error('Retarget/rename these clips in Blender first: '+missing.join(', '));
await writeFile('public/looma-baby.glb',bytes);
console.log('Imported rigged GLB with '+names.length+' clips. Run build and the desktop smoke test.');
