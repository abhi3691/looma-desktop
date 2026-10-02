import {test} from 'node:test';import assert from 'node:assert/strict';import {assistantIntent} from '../src/assistant-actions';
test('local reminder calculates due time and rejects zero and unbounded durations',()=>{
 assert.deepEqual(assistantIntent('Looma, remind me in 5 minutes to drink water',1000),{kind:'reminder',text:'drink water',due:301000});
 assert.equal(assistantIntent('remind me in 0 minutes to test'),undefined);
 assert.equal(assistantIntent('remind me in 999999 hours to test'),undefined);
});
test('desktop intents are bounded and external task requests stay with MCP',()=>{
 assert.deepEqual(assistantIntent('open calculator'),{kind:'open',app:'calculator'});
 assert.equal(assistantIntent('open rm -rf /'),undefined);
 assert.equal(assistantIntent('create a task for Santhosh'),undefined);
 assert.deepEqual(assistantIntent('add local task: review design'),{kind:'task',text:'review design'});
 assert.deepEqual(assistantIntent('enable daily briefing'),{kind:'briefing-toggle',enabled:true});
});
