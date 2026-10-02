import { wakeCommand } from "./wake-word";
import { voiceControl } from "./voice-control";
import { InterruptDetector, SpeechGate, isHumanVoice } from "./voice-activity";
import { SONG_HEADER } from "./song";
import { spokenReply } from "./reply-view";
import { encodeWav } from "./audio";
import type { Settings } from "./shared";
export class VoiceController {
  private opening = false;
  private captureGeneration = 0;
  private bargeStream?: MediaStream;
  private bargeContext?: AudioContext;
  private bargeProcessor?: ScriptProcessorNode;
  private bargeActive = false;
  private bargeInterrupted = false;
  get listening() {
    return this.recording || this.bargeActive;
  }
  lastHeard = "";
  devices: { id: string; label: string }[] = [];
  audioLevel = 0;
  lastAudioAt = 0;
  error = "";
  contextState = "closed";
  manuallyStopped = false;
  retryAfter = 0;
  conversing = false;
  speaking = false;
  private completeSpeech?: () => void;
  waking = false;
  private wakeSettings?: Settings;
  private awakeUntil = 0;
  private lastSound = 0;
  private heardSound = false;
  private restart?: ReturnType<typeof setTimeout>;
  recording = false;
  transcribing = false;
  private stream?: MediaStream;
  private context?: AudioContext;
  private processor?: ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private audio?: HTMLAudioElement;
  private generation = 0;
  constructor(
    private transcript: (text: string) => Promise<void>,
    private notify: (text: string) => void,
    private changed: () => void,
  ) {}
  async startConversation(settings: Settings) {
    if (!settings.voiceInput) return;
    this.conversing = true;
    this.manuallyStopped = false;
    this.waking = true;
    this.wakeSettings = settings;
    await this.toggle(settings);
  }
  async startWake(settings: Settings) {
    if (!settings.wakeWord || !settings.voiceInput) return;
    this.waking = true;
    this.wakeSettings = settings;
    this.awakeUntil = 0;
    await this.toggle(settings);
  }
  private async greet(question: string, settings: Settings) {
    const text = "നമസ്കാരം. ഞാൻ കേൾക്കുന്നുണ്ട്. എന്താണ് അറിയേണ്ടത്?";
    await window.careless.voice({action:"remember", question, text});
    await this.speak(text, settings);
  }
  stopWake() {
    this.manuallyStopped = true;
    this.conversing = false;
    this.waking = false;
    clearTimeout(this.restart);
    this.cancelRecording();
    this.stopSpeech();
  }
  recoverListening() {
    if (
      this.bargeActive &&
      this.bargeInterrupted &&
      Date.now() - this.lastAudioAt > 5000
    ) {
      this.stopBargeCapture();
      this.bargeInterrupted = false;
      this.notify("Microphone interrupted. Please say that again.");
    }
    if (
      !this.waking ||
      this.manuallyStopped ||
      this.opening ||
      this.transcribing ||
      this.speaking ||
      this.bargeActive
    )
      return;
    if (
      this.recording &&
      (Date.now() - this.lastAudioAt > 5000 ||
        this.stream
          ?.getAudioTracks()
          .every((track) => track.readyState === "ended"))
    ) {
      this.cancelRecording();
      this.notify("Reconnecting the microphone…");
    }
    if (!this.recording && this.wakeSettings && Date.now() >= this.retryAfter) {
      clearTimeout(this.restart);
      void this.toggle(this.wakeSettings);
    }
  }
  async toggle(settings: Settings) {
    if (this.opening) return;
    if (this.transcribing) {
      this.notify("Please wait for the current recording to finish.");
      return;
    }
    if (this.recording) {
      await this.finish();
      return;
    }
    if (!settings.voiceInput) {
      this.notify("Enable voice input in Settings first.");
      return;
    }
    this.stopSpeech();
    this.error = "";
    this.opening = true;
    const capture = ++this.captureGeneration;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(settings.microphoneId
            ? { deviceId: { exact: settings.microphoneId } }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (capture !== this.captureGeneration || this.manuallyStopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.devices = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === "audioinput")
        .slice(0, 30)
        .map((d, i) => ({
          id: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }));
      this.context = new AudioContext({ sampleRate: 16000 });
      if (this.context.sampleRate !== 16000)
        throw Error("This audio device does not support 16 kHz recording");
      await this.context.resume();
      this.contextState = this.context.state;
      const source = this.context.createMediaStreamSource(this.stream);
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      this.chunks = [];
      this.heardSound = false;
      this.lastSound = Date.now();
      this.lastAudioAt = Date.now();
      const speechGate = new SpeechGate();
      this.processor.onaudioprocess = (event) => {
        if (this.recording) {
          const samples = new Float32Array(event.inputBuffer.getChannelData(0));
          this.chunks.push(samples);
          this.lastAudioAt = Date.now();
          if (this.waking) {
            const rms = Math.sqrt(
              samples.reduce((sum, x) => sum + x * x, 0) / samples.length,
            );
            this.audioLevel = rms;
            if (
              speechGate.push(rms, samples.length / 16, isHumanVoice(samples))
            ) {
              if (!this.heardSound) {
                // Once a sentence begins, do not cut it at the idle wake window.
                clearTimeout(this.timer);
                this.timer = setTimeout(
                  () => void this.finish(),
                  this.conversing ? 30000 : 6500,
                );
              }
              this.heardSound = true;
              this.lastSound = Date.now();
            }
            // Keep a short pre-roll while waiting, without closing the mic
            // every eight seconds or accumulating minutes of room noise.
            if (!this.heardSound && this.chunks.length > 4) this.chunks.shift();
            if (this.heardSound && Date.now() - this.lastSound > 2200)
              void this.finish();
          }
        }
      };
      source.connect(this.processor);
      this.processor.connect(this.context.destination);
      this.recording = true;
      if (!this.waking)
        this.timer = setTimeout(() => void this.finish(), 60000);
      this.changed();
    } catch (e) {
      this.error = String(e);
      this.retryAfter = Date.now() + 5000;
      this.manuallyStopped = false;
      this.waking = false;
      this.cancelRecording();
      this.notify(
        "Microphone unavailable. Check the app’s microphone permission in OS settings.",
      );
    } finally {
      this.opening = false;
    }
  }
  cancelRecording() {
    this.captureGeneration++;
    this.recording = false;
    this.contextState = "closed";
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.processor?.disconnect();
    void this.context?.close().catch(() => {});
    this.stream = undefined;
    this.context = undefined;
    this.processor = undefined;
    this.changed();
  }
  private async finish() {
    if (!this.recording) return;
    const chunks = this.chunks;
    const wasWake = this.waking;
    this.transcribing = true;
    this.cancelRecording();
    try {
      if (!this.waking) this.notify("Transcribing on this device…");
      if (this.waking && !this.heardSound) return;
      const audio = encodeWav(chunks);
      const text = await window.careless.voice({
        action: "transcribe",
        audio,
        wake: wasWake && !this.conversing,
      });
      this.lastHeard = text.slice(0, 400);
      if (wasWake && !this.waking) return;
      if (wasWake && this.handleControl(text)) return;
      if (this.conversing) {
        const command = text
          .replace(/^(?:hi|hey|hello|hai)[,\s]*(?:looma|luma|ലൂമ)[,\s.!]*/i, "")
          .trim();
        if (command) await this.transcript(command);
        else if (this.wakeSettings?.voiceOutput)
          await this.greet(text, this.wakeSettings);
      } else if (this.waking) {
        let command = wakeCommand(text);
        if (command !== undefined) {
          this.conversing = true;
          this.awakeUntil = Date.now() + 20000;
          if (command.length > 3) {
            if (this.wakeSettings?.language !== "en") {
              const full: string = await window.careless.voice({
                action: "transcribe",
                audio,
              });
              this.lastHeard = full.slice(0, 400);
              command = wakeCommand(full) ?? full;
            }
            await this.transcript(command);
            this.awakeUntil = 0;
          } else {
            this.notify("I’m listening. What would you like to know?");
            if (this.wakeSettings?.voiceOutput)
              await this.greet(text, this.wakeSettings);
          }
        } else if (this.awakeUntil > Date.now()) {
          await this.transcript(text);
          this.awakeUntil = 0;
        }
      } else await this.transcript(text);
    } catch (e) {
      if (!String(e).includes("No speech detected")) {
        this.error = "Could not understand the recording. Please try again.";
        this.notify(this.error);
      }
    } finally {
      this.chunks = [];
      this.transcribing = false;
      this.changed();
      if (this.waking && this.wakeSettings && !this.bargeActive)
        this.restart = setTimeout(() => {
          if (!this.listening && !this.speaking && !this.transcribing)
            void this.toggle(this.wakeSettings!);
        }, 300);
    }
  }
  private handleControl(text: string) {
    const control = voiceControl(text);
    if (control === "mute") {
      this.stopWake();
      this.notify("മൈക്രോഫോൺ ഓഫ് ചെയ്തു.");
      return true;
    }
    if (control === "dismiss") {
      this.stopSpeech();
      this.conversing = false;
      this.awakeUntil = 0;
      this.notify("I’m here. Say Hi Looma when you need me.");
      return true;
    }
    return false;
  }
  private stopBargeCapture() {
    this.bargeActive = false;
    this.bargeStream?.getTracks().forEach((track) => track.stop());
    this.bargeProcessor?.disconnect();
    void this.bargeContext?.close().catch(() => {});
    this.bargeStream = undefined;
    this.bargeProcessor = undefined;
    this.bargeContext = undefined;
  }
  private async beginBargeCapture(epoch: number, settings: Settings) {
    if (!this.waking || !settings.voiceInput || this.bargeActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(settings.microphoneId
            ? { deviceId: { exact: settings.microphoneId } }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (epoch !== this.generation || !this.speaking) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.bargeStream = stream;
      this.bargeContext = new AudioContext({ sampleRate: 16000 });
      await this.bargeContext.resume();
      const source = this.bargeContext.createMediaStreamSource(stream);
      const processor = this.bargeContext.createScriptProcessor(1024, 1, 1);
      this.bargeProcessor = processor;
      const detector = new InterruptDetector(320);
      const captureStarted = Date.now();
      let chunks: Float32Array[] = [];
      let lastSound = Date.now();
      let started = 0;
      let completing = false;
      this.bargeActive = true;
      this.bargeInterrupted = false;
      const finish = async () => {
        if (completing) return;
        completing = true;
        this.stopBargeCapture();
        this.transcribing = true;
        this.changed();
        try {
          const text = await window.careless.voice({
            action: "transcribe",
            audio: encodeWav(chunks),
          });
          this.lastHeard = text.slice(0, 400);
          if (this.waking && !this.handleControl(text))
            await this.transcript(text);
        } catch (e) {
          if (!String(e).includes("No speech detected")) this.notify(String(e));
        } finally {
          this.transcribing = false;
          this.bargeInterrupted = false;
          this.changed();
          if (this.waking && this.wakeSettings)
            this.restart = setTimeout(() => {
              if (!this.listening && !this.speaking && !this.transcribing)
                void this.toggle(this.wakeSettings!);
            }, 300);
        }
      };
      processor.onaudioprocess = (event) => {
        if (!this.bargeActive) return;
        const frame = new Float32Array(event.inputBuffer.getChannelData(0));
        const rms = Math.sqrt(
          frame.reduce((sum, x) => sum + x * x, 0) / frame.length,
        );
        this.audioLevel = rms;
        this.lastAudioAt = Date.now();
        chunks.push(frame);
        if (Date.now() - captureStarted <= 700) detector.calibrate(rms);
        if (!this.bargeInterrupted) {
          if (
            Date.now() - captureStarted > 700 &&
            detector.push(rms, frame.length / 16, isHumanVoice(frame))
          ) {
            this.bargeInterrupted = true;
            started = Date.now();
            lastSound = started;
            this.stopSpeech(true);
            this.notify("I’m listening…");
            void window.careless.state("Watching");
          } else if (chunks.length > 16) chunks.shift();
        } else {
          if (detector.isVoice(rms) && isHumanVoice(frame))
            lastSound = Date.now();
          if (Date.now() - lastSound > 2200 || Date.now() - started > 60000)
            void finish();
        }
      };
      source.connect(processor);
      processor.connect(this.bargeContext.destination);
    } catch (e) {
      this.stopBargeCapture();
      this.error = "Interruption microphone unavailable: " + String(e);
      this.notify(this.error);
    }
  }
  stopSpeech(keepMicrophone = false) {
    if (!keepMicrophone) this.stopBargeCapture();
    this.generation++;
    this.completeSpeech?.();
    this.completeSpeech = undefined;
    this.speaking = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.dispatchEvent(new Event("ended"));
    }
    this.audio = undefined;
    speechSynthesis.cancel();
  }
  async speak(text: string, settings: Settings) {
    if (!settings.voiceOutput) {
      this.notify("Enable spoken replies in Settings first.");
      return;
    }
    const singing = text.startsWith(SONG_HEADER);
    text = spokenReply(text);
    const preparing = this.generation;
    if (!singing && settings.spokenLanguage === "ml") {
      try {
        text = await window.careless.voice({ action: "prepare-speech", text });
      } catch {
        this.notify("മലയാളം മറുപടി തയ്യാറാക്കാൻ കഴിഞ്ഞില്ല.");
        return;
      }
      if (preparing !== this.generation) return;
    }
    text = spokenReply(text);
    this.stopSpeech();
    const epoch = this.generation;
    this.speaking = true;
    this.changed();
    try {
      await window.careless.state("Talking");
      const voices = speechSynthesis.getVoices().filter((v) => v.localService);
      const language = /[\u0D00-\u0D7F]/.test(text) ? "ml" : "en";
      const matching = voices.filter((v) =>
        v.lang.toLowerCase().startsWith(language),
      );
      const selected = matching.find((v) => v.voiceURI === settings.voiceName);
      const feminine = matching.find((v) =>
        /Samantha|Karen|Moira|Tessa|Veena|Zira|Heera|Hazel|Jenny|Aria/i.test(
          v.name,
        ),
      );
      const local =
        language === "ml" && settings.voiceStyle === "female" && !selected
          ? undefined
          : (selected ??
            (settings.voiceStyle === "female" ? feminine : matching[0]));
      if (local && !singing && settings.speechProvider !== "edge") {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => finish(Error("Speech playback timed out")),
            90000,
          );
          const finish = (error?: Error) => {
            clearTimeout(timer);
            error ? reject(error) : resolve();
          };
          this.completeSpeech = () => finish();
          const utterance = new SpeechSynthesisUtterance(text.slice(0, 1500));
          utterance.voice = local;
          utterance.lang = local.lang;
          utterance.rate = 0.95;
          utterance.pitch = settings.cartoonVoice
            ? 1.4
            : settings.voiceStyle === "female"
              ? 1.08
              : 1;
          utterance.onend = () => finish();
          utterance.onerror = () =>
            finish(Error("Speech playback interrupted"));
          utterance.onstart = () =>
            void this.beginBargeCapture(epoch, settings);
          speechSynthesis.speak(utterance);
        });
      } else {
        // One neural utterance preserves pronunciation and sentence flow.
        const chunks = singing || settings.speechProvider === "edge" ? [text] : speechChunks(text);
        // Synthesize every chunk at once so the first one can start playing
        // while the rest are still being generated.
        const clips = chunks.map(async (chunk) => {
          const result = await window.careless.voice({
            action: singing ? "sing" : "synthesize",
            text: chunk,
          });
          if (result.warning) this.notify(result.warning);
          const bytes: Uint8Array =
            result instanceof Uint8Array ? result : result.audio;
          const mime = result instanceof Uint8Array ? "audio/wav" : result.mime;
          return URL.createObjectURL(
            new Blob([new Uint8Array(bytes).buffer], { type: mime }),
          );
        });
        clips.forEach((c) => c.catch(() => {}));
        try {
          for (let i = 0; i < clips.length; i++) {
            const url = await clips[i];
            if (epoch !== this.generation) return;
            this.audio = new Audio(url);
            const playback = this.audio;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                playback.pause();
                finish(Error("Speech playback timed out"));
              }, 90000);
              const finish = (error?: Error) => {
                clearTimeout(timer);
                error ? reject(error) : resolve();
              };
              this.completeSpeech = () => finish();
              playback.onended = () => finish();
              playback.onerror = () => finish(Error("Speech playback failed"));
              void playback
                .play()
                .then(() => {
                  if (i === 0) void this.beginBargeCapture(epoch, settings);
                })
                .catch((error) => finish(error));
            });
            if (epoch !== this.generation) return;
          }
        } finally {
          for (const c of clips)
            void c.then(URL.revokeObjectURL).catch(() => {});
        }
      }
    } catch (e) {
      if (epoch === this.generation)
        this.notify("Could not speak. " + String(e));
    } finally {
      if (epoch === this.generation) {
        this.stopBargeCapture();
        this.completeSpeech = undefined;
        this.speaking = false;
        this.changed();
        const current = await window.careless.snapshot();
        if (current.state === "Talking")
          await window.careless.state(
            settings.paused || current.resting ? "Sleeping" : "Idle",
          );
      }
    }
  }
}

function speechChunks(text: string) {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const last = chunks.length - 1;
    // Keep the first clip to one sentence so playback starts quickly.
    if (
      last > 0 &&
      (chunks[last].length + sentence.length < 220 || chunks.length >= 8)
    )
      chunks[last] += sentence;
    else chunks.push(sentence);
  }
  return chunks.map((c) => c.trim()).filter(Boolean);
}
