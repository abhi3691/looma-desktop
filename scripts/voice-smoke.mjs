import { LocalRuntime } from "../src/runtime.ts";
import { encodeWav } from "../src/audio.ts";
import { synthesize, transcribe } from "../src/voice.ts";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
if (process.platform !== "darwin")
  throw Error("This native speech check is configured for macOS.");
const dataDir = join(homedir(), "Library/Application Support/careless-ai");
const runtime = new LocalRuntime(resolve("."), dataDir, resolve("runtime"));
assert(
  runtime.status.whisperAvailable &&
    runtime.status.speechModelAvailable &&
    runtime.status.malayalamVoiceAvailable,
  "Complete local voice setup first",
);
mkdirSync("../../work/voice-check", { recursive: true });
const audio = await synthesize(
  runtime,
  "നമസ്കാരം. ഞാൻ ലൂമ. നിങ്ങളുടെ ജോലിയിൽ സഹായിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്.",
);
assert(audio.length > 44);
writeFileSync("../../work/voice-check/malayalam.wav", audio);
execFileSync("/usr/bin/say", [
  "-v",
  "Samantha",
  "-o",
  "../../work/voice-check/english.aiff",
  "Hello Looma. Please help me plan my work today.",
]);
execFileSync("/usr/bin/afconvert", [
  "-f",
  "WAVE",
  "-d",
  "LEI16@16000",
  "-c",
  "1",
  "../../work/voice-check/english.aiff",
  "../../work/voice-check/english.wav",
]);
const raw = readFileSync("../../work/voice-check/english.wav");
let pcm;
for (let offset = 12; offset + 8 <= raw.length;) {
  const size = raw.readUInt32LE(offset + 4);
  if (raw.toString("ascii", offset, offset + 4) === "data") {
    pcm = raw.subarray(offset + 8, offset + 8 + size);
    break;
  }
  offset += 8 + size + (size % 2);
}
assert(pcm);
const samples = new Float32Array(pcm.length / 2);
for (let i = 0; i < samples.length; i++)
  samples[i] = pcm.readInt16LE(i * 2) / 32768;
const result = await transcribe(runtime, encodeWav([samples]), "en");
assert.match(result, /help.*plan.*work/i);
console.log(
  "PASS: Malayalam speech synthesis and real offline Whisper transcription.",
);
console.log("Transcription:", result);
