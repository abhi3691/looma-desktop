/** Accept common local transcription spellings without waking on a bare greeting. */
export function wakeCommand(text: string): string | undefined {
  const match = text.match(
    /(?:\b(?:hi|hey|hello|hai|hay)[,\s.!-]*(?:looma|luma|loma|loom|loomer|luna|louna|louma|lu ma)\b)|(?:(?:ഹായ്|ഹൈ|ഹേ|ഹലോ)[,\s]*(?:ലൂമാ?|ലുമ|ലോമ))|(?:(?:हाय|हाई|हे|हैलो)[,\s]*(?:लूमा|लुमा|लोमा))/iu,
  );
  if (!match || (match.index ?? 0) > 60) return undefined;
  return text
    .slice((match.index ?? 0) + match[0].length)
    .replace(/^[\s,.!?]+/, "")
    .trim();
}
