import test from "node:test";
import assert from "node:assert/strict";
import {parseSettingsPatch} from "../src/settings-patch";
test("voice changes preserve unrelated microphone and reply preferences",()=>{
 assert.deepEqual(parseSettingsPatch({speechProvider:"offline"}),{speechProvider:"offline"});
 assert.deepEqual(parseSettingsPatch({language:"ml"}),{language:"ml"});
 assert.deepEqual(parseSettingsPatch({voiceOutput:true}),{voiceOutput:true});
 assert.deepEqual(parseSettingsPatch({voiceInput:true,wakeWord:true}),{voiceInput:true,wakeWord:true});
 assert.throws(()=>parseSettingsPatch({arbitrary:true}));
});
