import { hasSecret } from "./rules";
export function personalMemory(text: string, notes: string[]) {
  if (
    hasSecret(text) ||
    /(?:AIza[\w-]{20,}|sk[_-](?:live[_-])?[\w-]{15,}|lm_pat_[\w.-]{15,})/.test(
      text,
    )
  )
    return undefined;
  const name = text.match(
    /^(?:remember[,\s]+)?(?:my name is|call me|എന്റെ പേര്)\s+([^.!?\n]{1,60})[.!?]?$/i,
  );
  const preference = text.match(
    /^(?:remember[,\s]+)?(?:i prefer|i like|എനിക്ക് ഇഷ്ടം)\s+([^\n]{1,180})$/i,
  );
  if (name)
    return {
      save: "Name: " + name[1].trim(),
      answer: "ശരി, നിങ്ങളുടെ പേര് ഈ കമ്പ്യൂട്ടറിൽ മാത്രം ഓർത്തുവെക്കാം.",
    };
  if (preference)
    return {
      save: "Preference: " + preference[1].trim(),
      answer: "ശരി, നിങ്ങളുടെ ഈ ഇഷ്ടം ഇവിടെ മാത്രം ഓർത്തുവെക്കാം.",
    };
  if (
    /^(?:what(?: is|'s) my name|എന്റെ പേര് എന്താണ്)[?!.]*$/i.test(text.trim())
  ) {
    const name = notes.find((n) => n.startsWith("Name: "));
    return {
      answer: name
        ? "നിങ്ങളുടെ പേര് " + name.slice(6) + " ആണ്."
        : "നിങ്ങളുടെ പേര് ഇതുവരെ പറഞ്ഞിട്ടില്ല.",
    };
  }
  if (/what.*(?:remember|preferences)|എന്താണ് ഓർമ്മ/i.test(text))
    return {
      answer: notes.length
        ? "I remember these details locally:\n" +
          [...new Set(notes)]
            .slice(0, 20)
            .map((n) => "- " + n)
            .join("\n")
        : "I have no saved personal preferences yet.",
    };
}
