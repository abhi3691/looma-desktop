import type { PetState } from "./shared";
export type Gesture =
  "walk" | "fetch" | "stop" | "sit" | "wag" | "stretch" | "spin" | "play" | "sleep" | "wake" | "cuddle";
export function companionCommand(
  text: string,
): { gesture: Gesture; state: PetState; answer: string } | undefined {
  const phrase = text
    .toLowerCase()
    .trim()
    .replace(/^(?:hi|hey|hello)[,\s]+/, "")
    .replace(/^(?:looma|luma|ലൂമ)[,\s]+/, "")
    .replace(/^please\s+/, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const actions: [RegExp, Gesture, PetState, string][] = [
    [/^(?:walk|walk around|go for a walk|നടക്കൂ)$/, "walk", "Walking", "ഞാൻ ഒന്ന് നടക്കാം."],
    [/^(?:fetch|chase the ball|follow the ball|play ball|bring the ball|പന്ത് കളിക്കാം)$/, "fetch", "Walking", "പന്ത് നീക്കൂ, ഞാൻ പിന്നാലെ വരാം!"],
    [/^(?:stop walking|stop playing|stay|stay here|നിൽക്കൂ)$/, "stop", "Idle", "ശരി, ഞാൻ ഇവിടെ നിൽക്കാം."],
    [
      /^(?:sit|sit down|ഇരിക്കൂ|ഇരിക്ക്)$/,
      "sit",
      "Idle",
      "ശരി, ഞാൻ ഇവിടെ ഇരിക്കാം.",
    ],
    [
      /^(?:wag|wag your tail|good girl|good dog|വാലാട്ടൂ)$/,
      "wag",
      "Happy",
      "വൂഫ്! നിങ്ങളെ കണ്ടതിൽ സന്തോഷം.",
    ],
    [
      /^(?:stretch|do a stretch|നിവരൂ)$/,
      "stretch",
      "Idle",
      "ഒരു ചെറിയ സ്ട്രെച്ച്! നിങ്ങൾക്കും ഒന്ന് നിവരാം.",
    ],
    [/^(?:spin|turn around|കറങ്ങൂ)$/, "spin", "Happy", "ഇതാ ഒരു ചെറിയ കറക്കം!"],
    [
      /^(?:play|let.s play|play with me|കളിക്കാം)$/,
      "play",
      "Walking",
      "കളിക്കാം! ആദ്യം ഒരു ചെറിയ ചാട്ടം.",
    ],
    [
      /^(?:sleep|go to sleep|take a nap|ഉറങ്ങൂ|ഉറങ്ങിക്കോ)$/,
      "sleep",
      "Sleeping",
      "ഞാൻ കുറച്ചുനേരം ഉറങ്ങാം. സഹായം വേണമെങ്കിൽ ഹായ് ലൂമ എന്ന് വിളിക്കൂ.",
    ],
    [
      /^(?:wake|wake up|എഴുന്നേൽക്കൂ)$/,
      "wake",
      "Happy",
      "ഞാൻ എഴുന്നേറ്റു! എന്താണ് വേണ്ടത്?",
    ],
    [
      /^(?:cuddle|hug|pet|pet you|give me a hug|കെട്ടിപ്പിടിക്കാം)$/,
      "cuddle",
      "Happy",
      "ഒരു ചെറിയ വെർച്വൽ ആലിംഗനം! ഞാൻ ഇവിടെ കൂടെയുണ്ട്.",
    ],
  ];
  const found = actions.find(([pattern]) => pattern.test(phrase));
  return found
    ? { gesture: found[1], state: found[2], answer: found[3] }
    : undefined;
}
