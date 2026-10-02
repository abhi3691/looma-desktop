/**
 * True when the frame contains a human-voice pitch: a periodic signal with a
 * fundamental between ~85 and ~400 Hz. Broadband noise, hum, hiss, clicks and
 * high beeps are rejected because they have no pitch in that range.
 */
export function isHumanVoice(frame: Float32Array, sampleRate = 16000) {
  const size = 512,
    minLag = Math.floor(sampleRate / 1000),
    pitchMin = Math.floor(sampleRate / 400),
    pitchMax = Math.ceil(sampleRate / 85);
  if (frame.length < size + pitchMax + 1) return false;
  let voiced = 0,
    windows = 0;
  for (
    let start = 0;
    start + size + pitchMax + 1 <= frame.length;
    start += size
  ) {
    windows++;
    const x = frame.subarray(start, start + size + pitchMax + 1);
    let mean = 0;
    for (let i = 0; i < size; i++) mean += x[i];
    mean /= size;
    let energy = 0,
      crossings = 0;
    for (let i = 0; i < size; i++) {
      energy += (x[i] - mean) ** 2;
      if (i && x[i] - mean >= 0 !== x[i - 1] - mean >= 0) crossings++;
    }
    if (Math.sqrt(energy / size) < 0.004) continue;
    // Speech is neither a low rumble nor hissy broadband noise.
    const zcr = crossings / size;
    if (zcr < 0.01 || zcr > 0.4) continue;
    const corr: number[] = [];
    for (let lag = minLag; lag <= pitchMax + 1; lag++) {
      let sum = 0,
        shifted = 0;
      for (let i = 0; i < size; i++) {
        const b = x[i + lag] - mean;
        sum += (x[i] - mean) * b;
        shifted += b * b;
      }
      corr.push(sum / Math.sqrt(energy * shifted || 1));
    }
    // First strong peak decides the pitch; a peak above 400 Hz is a beep or
    // whistle, not a voice.
    for (let k = 1; k < corr.length - 1; k++) {
      if (corr[k] > 0.5 && corr[k] >= corr[k - 1] && corr[k] > corr[k + 1]) {
        if (k + minLag >= pitchMin) voiced++;
        break;
      }
    }
  }
  return voiced >= Math.max(1, Math.ceil(windows / 4));
}

/** Require sustained near-end voice rather than reacting to a click or a single noisy frame. */
export class InterruptDetector {
  constructor(private requiredVoiceMs = 192) {}
  private voiced = 0;
  private floor = 0.003;
  private quiet = 0;
  private calibration: number[] = [];
  reset() {
    this.voiced = 0;
    this.floor = 0.003;
    this.quiet = 0;
    this.calibration = [];
  }
  calibrate(rms: number) {
    this.calibration.push(rms);
    const quiet = [...this.calibration].sort((a,b)=>a-b);
    // A loud first syllable must not set an unreachable interruption threshold.
    this.floor = Math.min(0.012, quiet[Math.floor(quiet.length * 0.15)]);
  }
  isVoice(rms: number) {
    return rms > Math.max(0.012, this.floor * 2.8);
  }
  push(rms: number, milliseconds: number, human = true) {
    // Interrupting playback needs clearly louder sound than ambient noise or
    // the speaker's own echo, so low background noise never cuts speech off.
    const threshold = Math.max(0.022, this.floor * 2.8);
    if (human && rms > threshold) {
      this.voiced += milliseconds;
      this.quiet = 0;
    } else {
      this.quiet += milliseconds;
      if (this.quiet >= 128) this.voiced = 0;
      this.floor = this.floor * 0.95 + Math.min(rms, 0.01) * 0.05;
    }
    return this.voiced >= this.requiredVoiceMs;
  }
}

export class SpeechGate {
  private floor = 0.003;
  private samples: number[] = [];
  private warmup = 0;
  push(rms: number, milliseconds: number, human = true) {
    // Estimate the quiet end of the recent signal, not its loudest opening
    // frames: users often start speaking as soon as the microphone opens.
    const voice = human && rms > Math.max(0.006, this.floor * 1.8);
    this.samples.push(rms);
    if (this.samples.length > 40) this.samples.shift();
    if (this.samples.length >= 4) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      const quiet = sorted[Math.floor(sorted.length * 0.15)];
      this.floor = Math.min(0.012, quiet);
    }
    this.warmup += milliseconds;
    if (this.warmup <= 512) {
      this.floor = Math.min(0.012, rms);
      return false;
    }
    return voice;
  }
}
