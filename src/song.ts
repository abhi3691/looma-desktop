import { encodeWav } from "./audio";
export const SONG_HEADER = "### Looma’s song";
export const SONG = `${SONG_HEADER}\nചെറിയൊരു സ്വപ്നം കൂടെ വരാം\nപുഞ്ചിരി പൂവായി നാം വിടരാം\nകൂടെ നടക്കാം പാട്ടു പാടാം\nനല്ലൊരു നാളിനെ വരവേൽക്കാം`;
export const wantsSong = (text: string) =>
  /\b(?:sing|singing)\b|പാട്ട്.*പാട|പാടൂ|paattu.*paad|pattu.*pad/i.test(text);
export function melodyWave(waves: Uint8Array[]): Uint8Array {
  const notes = [0, 4, 7, 2];
  const out: Float32Array[] = [];
  const targetRate = 22050;
  for (let line = 0; line < waves.length; line++) {
    const bytes = waves[line];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    let rate = 22050,
      pcm: Uint8Array | undefined;
    for (let i = 12; i + 8 <= bytes.length;) {
      const n = view.getUint32(i + 4, true),
        tag = String.fromCharCode(...bytes.slice(i, i + 4));
      if (tag === "fmt ") {
        if (
          view.getUint16(i + 8, true) !== 1 ||
          view.getUint16(i + 10, true) !== 1 ||
          view.getUint16(i + 22, true) !== 16
        )
          throw Error("Song requires mono PCM");
        rate = view.getUint32(i + 12, true);
      }
      if (tag === "data") {
        pcm = bytes.subarray(i + 8, i + 8 + n);
        break;
      }
      i += 8 + n + (n % 2);
    }
    if (!pcm) throw Error("Missing song audio");
    const input = new DataView(pcm.buffer, pcm.byteOffset, pcm.length),
      count = pcm.length / 2;
    const pitch = 2 ** (notes[line % notes.length] / 12),
      step = (rate / targetRate) * pitch;
    const phrase = new Float32Array(Math.floor(count / step));
    for (let j = 0; j < phrase.length; j++) {
      const k = j * step,
        index = Math.floor(k),
        f = k - index;
      phrase[j] =
        ((input.getInt16(index * 2, true) * (1 - f) +
          input.getInt16(Math.min(index + 1, count - 1) * 2, true) * f) /
          32768) *
        0.8;
    }
    out.push(phrase, new Float32Array(targetRate * 0.25));
  }
  return encodeWav(out, targetRate);
}
