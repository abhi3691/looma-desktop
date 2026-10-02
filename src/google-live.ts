import { speechText } from "./speech-text";
import type { Message } from "./llm";
const audioCache = new Map<string, Uint8Array>();
export function liveQuestion(messages: Message[]) {
  return (
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content.slice(0, 4000) ?? ""
  );
}
export function takeLiveAudio(text: string) {
  const audio = audioCache.get(speechText(text));
  audioCache.delete(speechText(text));
  return audio;
}
export function liveReply(key: string, messages: Message[]): Promise<string> {
  const question = liveQuestion(messages);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=" +
        encodeURIComponent(key),
    );
    let text = "";
    const parts: Uint8Array[] = [];
    let size = 0;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ws.close();
      if (error) {
        reject(error);
        return;
      }
      if (!text.trim()) {
        reject(Error("Live model returned no transcript"));
        return;
      }
      if (size) {
        const wav = new Uint8Array(44 + size);
        const v = new DataView(wav.buffer);
        const ascii = (at: number, s: string) => {
          for (let i = 0; i < s.length; i++) wav[at + i] = s.charCodeAt(i);
        };
        ascii(0, "RIFF");
        v.setUint32(4, 36 + size, true);
        ascii(8, "WAVEfmt ");
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, 24000, true);
        v.setUint32(28, 48000, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        ascii(36, "data");
        v.setUint32(40, size, true);
        let at = 44;
        for (const p of parts) {
          wav.set(p, at);
          at += p.length;
        }
        while (audioCache.size >= 4)
          audioCache.delete(audioCache.keys().next().value!);
        audioCache.set(speechText(text), wav);
      }
      resolve(text);
    };
    const timer = setTimeout(
      () => finish(Error("Gemini Live timed out")),
      60000,
    );
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
              },
            },
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [
                {
                  text: "You are Looma, a friendly desktop puppy companion. Give brief, natural Malayalam answers unless asked for another language. Speak with a soft, bright, playful original cartoon voice. No emoji. You receive only the current question. You have no access to private tasks, previous conversation, live news or user activity. Never invent access or claim actions.",
                },
              ],
            },
          },
        }),
      );
    ws.onmessage = async (e) => {
      try {
        const m = JSON.parse(
          typeof e.data === "string" ? e.data : await (e.data as Blob).text(),
        );
        if (m.error) {
          finish(Error("Google Live rejected the request"));
          return;
        }
        if (m.setupComplete) {
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: question }] }],
                turnComplete: true,
              },
            }),
          );
          return;
        }
        const c = m.serverContent;
        if (!c) return;
        if (c.outputTranscription?.text) text += c.outputTranscription.text;
        for (const p of c.modelTurn?.parts ?? []) {
          if (p.inlineData?.data) {
            const b = Uint8Array.from(Buffer.from(p.inlineData.data, "base64"));
            size += b.length;
            if (size > 12000000) {
              finish(Error("Live audio exceeded size limit"));
              return;
            }
            parts.push(b);
          }
        }
        if (c.turnComplete) finish();
      } catch {
        finish(Error("Invalid Google Live response"));
      }
    };
    ws.onerror = () => finish(Error("Google Live connection failed"));
    ws.onclose = () => {
      if (!finished)
        finish(Error("Google Live closed before completing its reply"));
    };
  });
}
