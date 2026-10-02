const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const home = fs.mkdtempSync("/private/tmp/looma-wake-");
app.setPath("userData", home);
app.setAppPath(path.join(__dirname, ".."));
execFileSync("/usr/bin/say", [
  "-v",
  "Samantha",
  "-o",
  path.join(home, "wake.aiff"),
  process.env.WAKE_GREETING || process.env.WAKE_BARGE
    ? "Hi Looma."
    : "Hi Looma, sit down.",
]);
execFileSync("/usr/bin/afconvert", [
  "-f",
  "WAVE",
  "-d",
  "LEI16@16000",
  "-c",
  "1",
  path.join(home, "wake.aiff"),
  path.join(home, "wake.wav"),
]);
const raw = fs.readFileSync(path.join(home, "wake.wav"));
let pcm;
for (let i = 12; i + 8 <= raw.length;) {
  const n = raw.readUInt32LE(i + 4);
  if (raw.toString("ascii", i, i + 4) === "data") {
    pcm = raw.subarray(i + 8, i + 8 + n);
    break;
  }
  i += 8 + n + (n % 2);
}
assert(pcm);
const samples = Buffer.concat([
  Buffer.alloc(16000 * 2 * Number(process.env.WAKE_WAIT || 6)),
  pcm,
  Buffer.alloc(16000 * 2 * 5),
]);
const header = Buffer.alloc(44);
header.write("RIFF");
header.writeUInt32LE(36 + samples.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(16000, 24);
header.writeUInt32LE(32000, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(samples.length, 40);
const capture = path.join(home, "capture.wav");
fs.writeFileSync(capture, Buffer.concat([header, samples]));
app.commandLine.appendSwitch("no-sandbox"); // Test process only: Chromium must read the synthetic WAV fixture.
app.commandLine.appendSwitch("use-fake-device-for-media-stream");
app.commandLine.appendSwitch("use-file-for-fake-audio-capture", capture);
fs.writeFileSync(
  path.join(home, "runtime.json"),
  JSON.stringify({
    "whisper-cli": process.env.WAKE_BUNDLED ? path.join(__dirname,"../bundled-speech-runtime/whisper-cli") : "/opt/homebrew/bin/whisper-cli",
    speechModel: path.join(
      require("node:os").homedir(),
      "Library/Application Support/careless-ai/models/ggml-small.bin",
    ),
  }),
);
const actualData = path.join(
  require("node:os").homedir(),
  "Library/Application Support/careless-ai",
);
fs.mkdirSync(path.join(home, "models"), { recursive: true });
for (const name of ["ml_IN-meera-medium.onnx", "ml_IN-meera-medium.onnx.json"])
  fs.symlinkSync(
    path.join(actualData, "models", name),
    path.join(home, "models", name),
  );
const wakeModel=path.join(actualData,'models/ggml-tiny.en.bin');
if(fs.existsSync(wakeModel)) fs.symlinkSync(wakeModel,path.join(home,'models/ggml-tiny.en.bin'));
const runtimeConfig = JSON.parse(
  fs.readFileSync(path.join(home, "runtime.json"), "utf8"),
);
runtimeConfig["edge-tts"] = path.join(actualData, "piper-env/bin/edge-tts");
runtimeConfig.piper = path.join(actualData, "piper-env/bin/piper");
fs.writeFileSync(
  path.join(home, "runtime.json"),
  JSON.stringify(runtimeConfig),
);
if (process.env.WAKE_BARGE) {
  execFileSync("/usr/bin/say", [
    "-v",
    "Samantha",
    "-o",
    path.join(home, "interrupt.aiff"),
    "Please stop speaking and stretch now.",
  ]);
  execFileSync("/usr/bin/afconvert", [
    "-f",
    "WAVE",
    "-d",
    "LEI16@16000",
    "-c",
    "1",
    path.join(home, "interrupt.aiff"),
    path.join(home, "interrupt.wav"),
  ]);
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = setTimeout(() => {
  console.error("Wake test timed out");
  app.exit(1);
}, 90000);
require("../dist/main.cjs");
app.whenReady().then(async () => {
  try {
    let pet;
    for (let i = 0; i < 100; i++) {
      pet = BrowserWindow.getAllWindows().find(
        (w) => w.getBounds().width < 500,
      );
      if (pet && !pet.webContents.isLoading()) break;
      await delay(100);
    }
    const evaluate = (s) => pet.webContents.executeJavaScript(s);
    await evaluate(`window.__captureCount=0;const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async function(...args){const stream=await getMedia(...args);window.__captureCount++;window.__lastStream=stream;return stream;};
window.__playback={started:0,ended:0,natural:0,paused:0,types:[],errors:[]};
 const oldUrl=URL.createObjectURL;URL.createObjectURL=function(blob){window.__playback.types.push(blob.type);return oldUrl.call(URL,blob);};
 const oldProcessor=AudioContext.prototype.createScriptProcessor;
 AudioContext.prototype.createScriptProcessor=function(...args){const p=oldProcessor.apply(this,args);if(args[0]===1024)window.__bargeProcessor=p;return p;};
 const oldPause=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.pause=function(){if(!this.ended)window.__playback.paused++;return oldPause.call(this);};
 const original=HTMLMediaElement.prototype.play;
 HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>window.__playback.started++);this.addEventListener('ended',e=>{window.__playback.ended++;if(e.isTrusted)window.__playback.natural++;});this.addEventListener('error',()=>window.__playback.errors.push(this.error?.message));return original.call(this);}; void 0;`);
    let snapshot = await evaluate("window.careless.snapshot()");
    await evaluate(
      `window.careless.settings({...${JSON.stringify(snapshot.settings)},voiceInput:true,wakeWord:true,voiceOutput:true,cartoonVoice:true,speechProvider:'${process.env.WAKE_ONLINE ? "edge" : "offline"}',spokenLanguage:'ml',language:'en'})`,
    );
    let injected = false;
    for (let i = 0; i < 70; i++) {
      await delay(1000);
      snapshot = await evaluate("window.careless.snapshot()");
      const playback = await evaluate("window.__playback");
      if (
        process.env.WAKE_BARGE &&
        !injected &&
        (await evaluate(
          "Boolean(window.__bargeProcessor && window.__bargeProcessor.onaudioprocess)",
        ))
      ) {
        const raw = fs.readFileSync(path.join(home, "interrupt.wav"));
        let pcm;
        for (let j = 12; j + 8 <= raw.length;) {
          const size = raw.readUInt32LE(j + 4);
          if (raw.toString("ascii", j, j + 4) === "data") {
            pcm = raw.subarray(j + 8, j + 8 + size);
            break;
          }
          j += 8 + size + (size % 2);
        }
        const frames = Array(8000).fill(0);
        for (let j = 0; j < pcm.length / 2; j++)
          frames.push(Math.max(-1, Math.min(1, pcm.readInt16LE(j * 2) / 32768 * 3)));
        await evaluate(
          `(()=>{const samples=${JSON.stringify(frames)};let offset=0;const p=window.__bargeProcessor;const accept=p.onaudioprocess;p.onaudioprocess=null;const timer=setInterval(()=>{const frame=new Float32Array(1024);for(let k=0;k<1024;k++)frame[k]=samples[offset+k]??0;offset+=1024;accept?.({inputBuffer:{getChannelData:()=>frame}});if(offset>samples.length+48000)clearInterval(timer);},64);})();`,
        );
        injected = true;
        // The next capture is silence: do not replay the wake fixture into every
        // new microphone stream while validating the interrupted response.
        fs.writeFileSync(capture, Buffer.concat([header, Buffer.alloc(samples.length)]));
      }
      if (
        playback.natural > 0 &&
        (!process.env.WAKE_BARGE || playback.started >= 2)
      )
        break;
    }
    console.log("Voice health:", snapshot.voiceHealth);
    console.log(
      "Recognized messages:",
      snapshot.chat.map((x) => ({ kind: x.kind, text: x.text })),
    );
    assert(
      snapshot.voiceHealth.lastAudioAt > 0,
      "Audio callbacks must run in background",
    );
    if (!process.env.WAKE_GREETING && !process.env.WAKE_BARGE)
      assert(
        snapshot.chat.some((x) => x.kind === "user" && /sit/i.test(x.text)),
        "Wake phrase must dispatch spoken question",
      );
    if (!process.env.WAKE_GREETING && !process.env.WAKE_BARGE)
      assert(
        snapshot.chat.some((x) => x.kind === "assistant"),
        "Assistant must respond",
      );
    const playback = await evaluate("window.__playback");
    console.log("Playback:", playback);
    assert(
      playback.started > 0 && playback.ended > 0,
      "Meera audio must actually start and finish playing",
    );
    assert.equal(playback.errors.length, 0);
    if (process.env.WAKE_ONLINE)
      assert(
        playback.types.includes("audio/mpeg"),
        "Online Sobhana must provide MP3, rather than offline fallback",
      );
    assert(playback.natural > 0, "Reply must finish playing naturally");
    if (process.env.WAKE_BARGE) {
      assert(playback.paused > 0, "User speech must stop the current audio");
      assert(
        snapshot.chat.some((x) => x.kind === "user" && /stretch/i.test(x.text)),
        "Interrupted question must be recognized and answered",
      );
    }
    for(let i=0;i<10;i++) {
      await delay(500);
      snapshot=await evaluate("window.careless.snapshot()");
      if(snapshot.voiceHealth.recording && !snapshot.voiceHealth.transcribing) break;
    }
    assert(snapshot.voiceHealth.recording && snapshot.voiceHealth.waking, "Listening must resume after the spoken reply");
    if(process.env.WAKE_RECOVERY) {
      const count=await evaluate("window.__captureCount");
      await evaluate("window.__lastStream.getTracks().forEach(t=>t.stop())");
      await delay(8000);
      assert((await evaluate("window.__captureCount"))>count, "Dead microphone stream must reopen automatically");
    }
    console.log(
      "PASS: Background microphone capture → real Whisper → Hi Looma wake → companion response.",
    );
    clearTimeout(deadline);
    app.exit(0);
  } catch (e) {
    console.error(e);
    clearTimeout(deadline);
    app.exit(1);
  }
});
app.on("will-quit", () => fs.rmSync(home, { recursive: true, force: true }));
