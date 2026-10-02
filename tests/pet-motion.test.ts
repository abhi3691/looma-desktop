import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionStep} from '../src/pet-motion';
import {companionCommand} from '../src/companion';
test('desktop chase moves toward ball and stays inside a display with negative coordinates',()=>{
 const area={x:-1200,y:0,width:1200,height:800};
 let pet={x:-300,y:400,width:240,height:260};
 for(let i=0;i<500;i++){pet={...pet,...motionStep(pet,{x:500,y:900},area)};assert.ok(pet.x>=-1200&&pet.x<=-240);assert.ok(pet.y>=0&&pet.y<=540);}
 assert.equal(pet.x,-240);assert.equal(pet.y,540);
});
test('companion ball and movement instructions route locally',()=>{
 assert.equal(companionCommand('Looma, chase the ball')?.gesture,'fetch');
 assert.equal(companionCommand('walk around')?.gesture,'walk');
 assert.equal(companionCommand('stop playing')?.gesture,'stop');
 assert.equal(companionCommand('what are my tasks today'),undefined);
});
