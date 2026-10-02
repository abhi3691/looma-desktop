import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicRequest} from '../src/music-request';
test('song request asks type and movie name instead of repeating preset',()=>{
 const m=new MusicRequest();assert.match(m.next('sing a song')!.answer,/What kind/);
 assert.match(m.next('movie song')!.answer,/Which movie/);
 assert.equal(m.next('Premam')!.query,'Premam movie song');
 assert.equal(m.next('hello'),undefined);
 assert.match(m.next('sing a song')!.answer,/What kind/);
});
test('music followup expires, cancels and does not consume other commands',()=>{
 const m=new MusicRequest();m.next('sing a song',0);assert.equal(m.next('movie',120001),undefined);
 m.next('sing a song');assert.match(m.next('cancel')!.answer,/cancelled/);
 m.next('sing a song');assert.equal(m.next('turn on desk lamp'),undefined);
 assert.equal(m.next('play a song from Premam')!.query,'from Premam');
});
