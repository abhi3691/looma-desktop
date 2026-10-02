import test from "node:test";
import assert from "node:assert/strict";
import { companionCommand } from "../src/companion";
test("companion gestures respond locally and leave task questions alone", () => {
  assert.equal(companionCommand("Looma, go to sleep")?.state, "Sleeping");
  assert.equal(companionCommand("wag your tail")?.gesture, "wag");
  assert.equal(companionCommand("wake up")?.state, "Happy");
  assert.equal(companionCommand("ഇരിക്കൂ")?.gesture, "sit");
  assert.equal(companionCommand("walk through my tasks"), undefined);
  assert.equal(companionCommand("create a task to play the demo"), undefined);
});
