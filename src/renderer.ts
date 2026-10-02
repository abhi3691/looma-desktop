import { replyHTML } from "./reply-view";
import { VoiceController } from "./voice-ui";
import { dog } from "./dog";
import { type Snapshot } from "./shared";
const root = document.querySelector<HTMLDivElement>("#app")!;
let data: Snapshot;
let pending = false;
let petExpanded = false;
let petReply = "";
let toastTimer: ReturnType<typeof setTimeout>;
const api = window.careless;
const voice = new VoiceController(
  async (text) => {
    if (pending) {
      toast("Looma is already answering. Try again in a moment.");
      return;
    }
    const inConversation = voice.conversing;
    pending = true;
    render();
    try {
      const answer = await api.chat(text);
      petReply = answer;
      if (petExpanded) await api.action("pet-expand");
      await refresh(true);
      if (data.settings.voiceOutput && (!inConversation || voice.conversing))
        await voice.speak(answer, data.settings);
    } finally {
      pending = false;
      await refresh(true);
    }
  },
  (text) => toast(text),
  () => {
    render();
  },
);
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function toast(s: string) {
  const el = document.querySelector("#toast")!;
  {
    petReply = s;
    const bubble = document.querySelector(".pet-bubble");
    if (bubble) bubble.textContent = s.slice(0, 180);
  }
  el.textContent = s;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 6000);
}
async function run(fn: () => Promise<unknown>) {
  try {
    await fn();
    await refresh(true);
  } catch (e) {
    toast(String(e).replace("Error invoking remote method: ", ""));
  }
}
function render() {
  if (!data) return;
  const phase = voice.speaking
    ? "Speaking"
    : pending
      ? "Thinking"
      : voice.transcribing
        ? "Understanding"
        : voice.conversing
          ? "Listening"
          : "Ready";
  document.documentElement.className = document.body.className = "pet-mode";
  root.innerHTML = `<div class="floating ${petExpanded ? "expanded" : ""} voice-${phase.toLowerCase()} gesture-${data.gesture} state-${data.state.toLowerCase()}"><div class="pet-bubble" id="petTranscript" role="button" tabindex="0" title="Show or hide the last reply">${petExpanded && petReply ? replyHTML(petReply) : esc(phase === "Ready" ? (voice.waking ? "Say Hi Looma" : !data.settings.voiceInput || !data.settings.wakeWord ? "Microphone off" : !data.runtime.speechModelAvailable ? "Preparing speech model…" : !data.runtime.whisperAvailable ? "Speech runtime needed" : voice.error || "Starting microphone…") : phase + "…")}</div><div id="petCharacter" aria-label="Double-click to open your workspace">${dog()}</div></div><div id="toast"></div>`;
  const toggleTranscript = () =>
    void run(async () => {
      petExpanded = !petExpanded;
      await api.action(petExpanded ? "pet-expand" : "pet-compact");
    });
  document
    .querySelector("#petTranscript")!
    .addEventListener("click", toggleTranscript);
  document.querySelector("#petTranscript")!.addEventListener("keydown", (e) => {
    if (["Enter", " "].includes((e as KeyboardEvent).key)) {
      e.preventDefault();
      toggleTranscript();
    }
  });
  let petting: ReturnType<typeof setTimeout>;
  const character = document.querySelector<HTMLElement>("#petCharacter")!;
  character.addEventListener("click", () => {
    clearTimeout(petting);
    petting = setTimeout(
      () =>
        void run(async () => {
          petReply = await api.action("pet-affection");
        }),
      250,
    );
  });
  let dragFrom: { x: number; y: number } | undefined;
  let dragged = false;
  character.addEventListener("pointerdown", (event) => {
    dragFrom = { x: event.screenX, y: event.screenY };
    dragged = false;
    character.setPointerCapture(event.pointerId);
  });
  character.addEventListener("pointermove", (event) => {
    if (!dragFrom) return;
    const dx = event.screenX - dragFrom.x,
      dy = event.screenY - dragFrom.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    dragged = true;
    dragFrom = { x: event.screenX, y: event.screenY };
    api.moveBy(dx, dy);
  });
  const endDrag = () => {
    dragFrom = undefined;
  };
  character.addEventListener("pointerup", endDrag);
  character.addEventListener("pointercancel", endDrag);
  character.addEventListener(
    "click",
    (event) => {
      if (dragged) {
        event.stopImmediatePropagation();
        dragged = false;
      }
    },
    true,
  );
  character.addEventListener("dblclick", () => {
    clearTimeout(petting);
    void api.action("dashboard");
  });
  character.addEventListener("pointermove", (event) => {
    const box = character.getBoundingClientRect();
    character.style.setProperty(
      "--gaze-x",
      Math.max(-3, Math.min(3, (event.clientX - box.x - box.width / 2) / 20)) +
        "px",
    );
    character.style.setProperty(
      "--gaze-y",
      Math.max(-2, Math.min(2, (event.clientY - box.y - box.height / 2) / 25)) +
        "px",
    );
  });
  character.addEventListener("pointerleave", () => {
    character.style.setProperty("--gaze-x", "0px");
    character.style.setProperty("--gaze-y", "0px");
  });
}
async function refresh(force = false) {
  voice.recoverListening();
  await api.voiceHealth({
    recording: voice.listening,
    waking: voice.waking,
    transcribing: voice.transcribing,
    audioLevel: voice.audioLevel,
    lastAudioAt: voice.lastAudioAt,
    error: voice.error,
    contextState: voice.contextState,
    lastHeard: voice.lastHeard,
    devices: voice.devices,
  });
  const next = await api.snapshot();
  const changed =
    !data || next.state !== data.state || next.gesture !== data.gesture;
  const enabled = !data?.settings.wakeWord && next.settings.wakeWord;
  data = next;
  if (enabled) voice.manuallyStopped = false;
  if (
    data.settings.wakeWord &&
    data.settings.voiceInput &&
    data.runtime.whisperAvailable &&
    data.runtime.speechModelAvailable &&
    !voice.waking &&
    !voice.manuallyStopped &&
    Date.now() >= voice.retryAfter &&
    !voice.transcribing &&
    !pending
  )
    void voice.startWake(data.settings);
  if (
    (!data.settings.voiceInput ||
      (!data.settings.wakeWord && !voice.conversing)) &&
    voice.waking
  )
    voice.stopWake();
  if (force || changed || !root.innerHTML) render();
}
api.onSpeech((text) => {
  if (
    data?.settings.announcements &&
    !voice.recording &&
    !voice.transcribing &&
    !pending
  )
    void voice.speak(text, data.settings);
});
api.onRestartVoice(() => {
  voice.stopWake();
  voice.manuallyStopped = false;
  void refresh(true);
});
api.onTestVoice(() => {
  void run(async () => {
    voice.stopWake();
    await voice.speak(
      "നമസ്കാരം. ഞാൻ ലൂമ. നിങ്ങളുടെ ശബ്ദം കേൾക്കാൻ ഞാൻ തയ്യാറാണ്.",
      data.settings,
    );
    voice.manuallyStopped = false;
  });
});
let wakeBeforeSleep = false;
api.onSuspend(() => {
  // A repeated suspend must not overwrite the state saved by the first one.
  wakeBeforeSleep = wakeBeforeSleep || voice.waking;
  voice.stopWake();
});
api.onResume(() => {
  if (wakeBeforeSleep) {
    voice.manuallyStopped = false;
    wakeBeforeSleep = false;
    void refresh(true);
  }
});
void refresh(true).catch((e) => {
  root.textContent = "Unable to start: " + String(e);
});
setInterval(() => void refresh().catch(() => {}), 1000);
document.addEventListener("click", (event) => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>(
    "a[data-source]",
  );
  if (anchor) {
    event.preventDefault();
    void api.openLink(anchor.href).catch((e) => toast(String(e)));
  }
});
