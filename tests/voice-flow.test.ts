import test from "node:test";
import assert from "node:assert/strict";
import { InterruptDetector } from "../src/voice-activity";
import { speechText } from "../src/speech-text";
test("voice interruption requires sustained speech, rejects clicks and ambient noise", () => {
  const d = new InterruptDetector();
  for (let i = 0; i < 20; i++) assert(!d.push(0.004, 64));
  assert(!d.push(0.08, 64));
  assert(!d.push(0.003, 64));
  assert(!d.push(0.003, 64));
  assert(!d.push(0.05, 64));
  assert(!d.push(0.05, 64));
  assert(d.push(0.05, 64));
});
test("low background noise never interrupts playback", () => {
  const d = new InterruptDetector(500);
  for (let i = 0; i < 100; i++) assert(!d.push(0.02, 64));
});
test("Malayalam speech cleans formatting and expands names without changing facts", () => {
  assert.equal(
    speechText("**Looma** 😄 MCP വഴി Abhinand സഹായിക്കും."),
    "ലൂമ എം സി പി വഴി അഭിനന്ദ് സഹായിക്കും.",
  );
  assert.equal(speechText("ന്‍"), "ൻ");
  assert.match(speechText("ജോലി 42"), /42/);
});

import { voiceControl } from "../src/voice-control";
test("stop dismisses a turn while explicit stop listening mutes the microphone", () => {
  assert.equal(voiceControl("Looma, stop."), "dismiss");
  assert.equal(voiceControl("stop listening"), "mute");
  assert.equal(voiceControl("നിർത്തൂ"), "dismiss");
  assert.equal(voiceControl("stop working on that task"), undefined);
});

test("playback interruption requires a longer sustained voice signal", () => {
  const detector = new InterruptDetector(320);
  assert.equal(detector.push(0.04, 192), false);
  assert.equal(detector.push(0.04, 128), true);
});

import { SpeechGate } from "../src/voice-activity";
test("room noise does not hold speech detection open", () => {
  const gate = new SpeechGate();
  for (let i = 0; i < 10; i++) assert.equal(gate.push(0.017, 256), false);
  assert.equal(gate.push(0.05, 256), true);
  assert.equal(gate.push(0.017, 256), false);
});

test("opening speech cannot become an unreachable noise threshold", () => {
  const gate = new SpeechGate();
  gate.push(0.06, 256);
  gate.push(0.06, 256);
  assert.equal(gate.push(0.03, 256), true);
  assert.equal(gate.push(0.002, 256), false);
});

import { wakeCommand } from "../src/wake-word";
test("wake phrase tolerates spelling and Malayalam without waking on greetings alone", () => {
  assert.equal(
    wakeCommand("Hi, Looma! What are my tasks?"),
    "What are my tasks?",
  );
  assert.equal(wakeCommand("Hi Luna."), "");
  assert.equal(wakeCommand("ഹായ് ലൂമാ, എന്തൊക്കെ?"), "എന്തൊക്കെ?");
  assert.equal(wakeCommand("Hi, what are my tasks?"), undefined);
  assert.equal(wakeCommand("the loom is running"), undefined);
});

import { isHumanVoice } from "../src/voice-activity";
const signal = (fn: (t: number) => number, n = 4096) =>
  Float32Array.from({ length: n }, (_, i) => fn(i / 16000));
const voiceLike = (f0: number) =>
  signal(
    (t) =>
      [1, 2, 3, 4].reduce(
        (sum, h) => sum + Math.sin(2 * Math.PI * f0 * h * t) / h,
        0,
      ) * 0.1,
  );
test("human voice detector accepts pitched speech and rejects noise", () => {
  assert(isHumanVoice(voiceLike(120)));
  assert(isHumanVoice(voiceLike(220)));
  let seed = 1;
  const noise = signal(() => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 0.3;
  });
  assert(!isHumanVoice(noise));
  assert(!isHumanVoice(signal((t) => 0.2 * Math.sin(2 * Math.PI * 50 * t))));
  assert(!isHumanVoice(signal((t) => 0.2 * Math.sin(2 * Math.PI * 1000 * t))));
  const click = new Float32Array(4096);
  click[100] = 0.9;
  assert(!isHumanVoice(click));
});

test("a loud opening sound does not prevent normal speech interrupting",()=>{
 const detector = new InterruptDetector(320);
 detector.calibrate(0.12);
 for(let i=0;i<10;i++) detector.calibrate(0.003);
 for(let i=0;i<4;i++) assert.equal(detector.push(0.028,64,true),false);
 assert.equal(detector.push(0.028,64,true),true);
});
