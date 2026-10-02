import {app,safeStorage} from 'electron';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Connections,connectionSchema} from '../src/mcp';
app.setName('careless-ai');
app.whenReady().then(async()=>{try{
 const file=join(app.getPath('appData'),'careless-ai','connections.enc');
 const values=JSON.parse(safeStorage.decryptString(readFileSync(file)));
 const configs=values.map((value:unknown)=>connectionSchema.parse(value));
 const manager=new Connections(configs,()=>{});
 await manager.restore();
 const taskAnswer = await manager.query('What are Abhinand tasks today?', undefined, 'Abhinand');
 console.log(JSON.stringify({taskQueryReturned: !/No task connection|could not|failed/i.test(taskAnswer), formatted: taskAnswer.includes('|'), length:taskAnswer.length}));
 console.log(JSON.stringify(manager.list().map(c=>({name:c.name,hasToken:c.hasToken,connected:c.connected,autoConnect:c.autoConnect,tool:c.tool,tools:c.tools.map(t=>t.name),error:c.error}))));
 for(const c of configs)await manager.disconnect(c.id);
 app.exit(0);
}catch{console.error('Could not unlock saved MCP configuration');app.exit(1)}});
