import { spokenReply } from "./reply-view";
export function speechText(text: string) {
  let clean = spokenReply(text)
    .normalize("NFC")
    .replace(/\*{1,2}|`/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[()]/g, "")
    .trim();
  const legacy: Record<string, string> = {
    ണ്‍: "ൺ",
    ന്‍: "ൻ",
    ര്‍: "ർ",
    ല്‍: "ൽ",
    ള്‍: "ൾ",
    ക്‍: "ൿ",
  };
  for (const [from, to] of Object.entries(legacy))
    clean = clean.split(from).join(to);
  if (/[\u0D00-\u0D7F]/.test(clean)) {
    const names: Record<string, string> = {
      Looma: "ലൂമ",
      Qwen: "ക്വെൻ",
      MCP: "എം സി പി",
      AI: "എ ഐ",
      Abhinand: "അഭിനന്ദ്",
      Santhosh: "സന്തോഷ്",
    };
    for (const [from, to] of Object.entries(names))
      clean = clean.replace(new RegExp("\\b" + from + "\\b", "gi"), to);
  }
  return clean.replace(/\s+/g, " ").slice(0, 1500);
}
