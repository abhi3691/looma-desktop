import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { LocalRuntime } from "./runtime";
import { speechText } from "./speech-text";
import { validateWav } from "./audio";
const execute = promisify(execFile);
export async function transcribe(
  runtime: LocalRuntime,
  bytes: Uint8Array,
  language: "auto" | "ml" | "en",
  wake = false,
) {
  validateWav(bytes);
  const cli = runtime.path("whisper-cli"),
    model = wake ? runtime.wakeModel() : runtime.speechModel();
  if (!cli || !model)
    throw Error(
      "Install whisper.cpp and select a multilingual Whisper model in Settings",
    );
  const dir = mkdtempSync(join(tmpdir(), "careless-voice-"));
  try {
    const audio = join(dir, "input.wav"),
      output = join(dir, "transcript");
    writeFileSync(audio, bytes, { mode: 0o600 });
    await execute(
      cli,
      [
        // CPU inference avoids first-run Metal compilation blocking wake recognition.
        "-ng",
        "-m",
        model,
        "-f",
        audio,
        "-l",
        wake ? "en" : language,
        "-otxt",
        "-of",
        output,
        ...(wake ? ["--prompt", "Hi Looma. Hello Looma. Hey Looma."] : []),
        "-nt",
        "-np",
      ],
      { timeout: wake ? 15000 : 60000, maxBuffer: 2097152, windowsHide: true },
    );
    const text = readFileSync(output + ".txt", "utf8")
      .trim()
      .slice(0, 4000);
    if (!text || /^(?:\[[^\]]*\]|\([^)]*\))$/.test(text))
      throw Error("No speech detected. Try a clearer recording.");
    return text;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
export async function synthesize(
  runtime: LocalRuntime,
  text: string,
  style: "female" | "neutral" = "female",
) {
  text = speechText(text);
  const neural =
    style === "female" &&
    /[\u0D00-\u0D7F]/.test(text) &&
    runtime.path("piper") &&
    runtime.femaleVoiceModel();
  const cli = neural ? runtime.path("piper") : runtime.path("espeak-ng");
  if (!cli)
    throw Error("Local Malayalam speaker unavailable. Install eSpeak NG.");
  const dir = mkdtempSync(join(tmpdir(), "careless-speech-"));
  try {
    const file = join(dir, "speech.wav");
    const language = /[\u0D00-\u0D7F]/.test(text) ? "ml" : "en";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        cli,
        neural
          ? ["--model", neural, "--output-file", file]
          : [
              "-v",
              style === "female" ? language + "+f3" : language,
              "-s",
              "155",
              "-p",
              style === "female" ? "60" : "50",
              "-w",
              file,
              "--stdin",
            ],
        { stdio: ["pipe", "ignore", "ignore"], windowsHide: true },
      );
      const timer = setTimeout(() => {
        child.kill();
        reject(Error("Speech synthesis timed out"));
      }, 30000);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        code === 0
          ? resolve()
          : reject(Error("Local speaker could not synthesize this text"));
      });
      child.stdin?.on("error", () => {});
      child.stdin?.end(text.slice(0, 1500));
    });
    return new Uint8Array(readFileSync(file));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function synthesizeOnline(
  runtime: LocalRuntime,
  text: string,
  cartoon = false,
) {
  const cli = runtime.path("edge-tts");
  if (!cli) throw Error("Install edge-tts to use the online voice");
  const dir = mkdtempSync(join(tmpdir(), "looma-online-voice-"));
  try {
    const input = join(dir, "reply.txt"),
      output = join(dir, "reply.mp3");
    text = speechText(text);
    if (cartoon && !/[\u0D00-\u0D7F]/.test(text))
      text = text.replace(/[.!?]*\s*$/, "! Woof woof!");
    writeFileSync(input, text, { mode: 0o600 });
    await execute(
      cli,
      [
        "--file",
        input,
        "--voice",
        /[\u0D00-\u0D7F]/.test(text)
          ? "ml-IN-SobhanaNeural"
          : cartoon
            ? "en-US-AnaNeural"
            : "en-IN-NeerjaNeural",
        "--rate=-5%",
        cartoon ? "--pitch=+8Hz" : "--pitch=+0Hz",
        "--write-media",
        output,
      ],
      { timeout: 30000, maxBuffer: 1048576, windowsHide: true },
    );
    const audio = new Uint8Array(readFileSync(output));
    if (audio.length < 100) throw Error("No online voice audio received");
    return { audio, mime: "audio/mpeg", provider: "Sobhana" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
