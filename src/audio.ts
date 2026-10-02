export function encodeWav(
  chunks: Float32Array[],
  sampleRate = 16000,
): Uint8Array {
  const size = chunks.reduce((n, c) => n + c.length, 0);
  if (size > sampleRate * 60)
    throw Error("Recordings are limited to 60 seconds");
  const bytes = new Uint8Array(44 + size * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + size * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, size * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const sample of chunk) {
      const n = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, n < 0 ? n * 32768 : n * 32767, true);
      offset += 2;
    }
  return bytes;
}
export function validateWav(bytes: Uint8Array) {
  if (bytes.byteLength < 44 || bytes.byteLength > 1920044)
    throw Error("Invalid recording size");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  if (
    text(0, 4) !== "RIFF" ||
    text(8, 12) !== "WAVE" ||
    text(12, 16) !== "fmt " ||
    text(36, 40) !== "data" ||
    v.getUint16(20, true) !== 1 ||
    v.getUint16(22, true) !== 1 ||
    v.getUint32(24, true) !== 16000 ||
    v.getUint16(34, true) !== 16 ||
    v.getUint32(40, true) !== bytes.length - 44
  )
    throw Error("Use mono 16 kHz PCM WAV audio");
}
