import { z } from "zod";
export const states = [
  "Idle",
  "Walking",
  "Watching",
  "Thinking",
  "Warning",
  "Talking",
  "Happy",
  "Sleeping",
] as const;
export type PetState = (typeof states)[number];
export const settingsSchema = z
  .object({
    personalization: z.boolean().default(false),
    cartoonVoice: z.boolean().default(false),
    speechProvider: z.enum(["offline", "edge"]).default("offline"),
    internet: z.boolean().default(false),
    launchAtLogin: z.boolean().default(false),
    spokenLanguage: z.enum(["auto", "ml", "en"]).default("auto"),
    paused: z.boolean(),
    activity: z.boolean(),
    clipboard: z.boolean(),
    screen: z.boolean(),
    notifications: z.boolean(),
    breaks: z.boolean(),
    secrets: z.boolean(),
    switching: z.boolean(),
    pet: z.boolean(),
    exclusions: z.array(z.string().trim().min(1).max(100)).max(50),
    provider: z.enum(["mock", "ollama", "llamacpp", "google"]),
    model: z
      .string()
      .regex(/^[a-zA-Z0-9_.:/-]{1,100}$/)
      .refine(
        (v) => !v.toLowerCase().includes("cloud"),
        "Choose a local model",
      ),
    microphoneId: z.string().max(256).default(""),
    voiceInput: z.boolean().default(false),
    voiceOutput: z.boolean().default(false),
    announcements: z.boolean().default(false),
    language: z.enum(["auto", "ml", "en"]).default("auto"),
    wakeWord: z.boolean().default(false),
    taskOwner: z.string().trim().max(100).default(""),
    voiceStyle: z.enum(["female", "neutral"]).default("female"),
    voiceName: z.string().max(200).default(""),
    retention: z.number().int().min(1).max(90),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaults: Settings = {
  personalization: false,
  cartoonVoice: false,
  speechProvider: "offline",
  internet: false,
  launchAtLogin: false,
  spokenLanguage: "auto",
  paused: false,
  activity: false,
  clipboard: false,
  screen: false,
  notifications: true,
  breaks: true,
  secrets: true,
  switching: true,
  pet: true,
  exclusions: ["1Password", "Keychain", "Bitwarden"],
  provider: "mock",
  model: "qwen3.5:4b",
  microphoneId: "",
  voiceInput: false,
  voiceOutput: false,
  announcements: false,
  language: "auto",
  wakeWord: false,
  taskOwner: "",
  voiceStyle: "female",
  voiceName: "",
  retention: 30,
};
export type Entry = { id: number; time: number; kind: string; text: string };
export type Snapshot = {
  voiceHealth: {
    recording: boolean;
    waking: boolean;
    transcribing: boolean;
    audioLevel: number;
    lastAudioAt: number;
    error: string;
    contextState: string;
    permission: string;
    lastHeard: string;
    devices: { id: string; label: string }[];
  };
  settings: Settings;
  entries: Entry[];
  chat: Entry[];
  state: PetState;
  gesture: string;
  resting: boolean;
  status: string;
  today: { activities: number; warnings: number };
  usage: { app: string; seconds: number }[];
  dailyWork: Entry[];
  runtime: import("./runtime").RuntimeStatus;
  screenPermission: string;
};
export interface API {
  moveBy(dx: number, dy: number): void;
  openLink(url: string): Promise<void>;
  voiceHealth(status: Record<string, unknown>): Promise<void>;
  onRestartVoice(fn: () => void): void;
  onTestVoice(fn: () => void): void;
  onSuspend(fn: () => void): void;
  onResume(fn: () => void): void;
  onChat(fn: () => void): void;
  onSpeech(fn: (text: string) => void): void;
  model(action: string): Promise<import("./runtime").RuntimeStatus>;
  voice(payload: Record<string, unknown>): Promise<any>;
  snapshot(): Promise<Snapshot>;
  googleKey(key: string): Promise<void>;
  settings(s: Settings): Promise<void>;
  chat(text: string, source?: string): Promise<string>;
  work(text: string): Promise<void>;
  mcp(value: Record<string, unknown>): Promise<any>;
  action(a: string): Promise<string>;
  state(s: PetState): Promise<void>;
}
declare global {
  interface Window {
    careless: API;
  }
}
