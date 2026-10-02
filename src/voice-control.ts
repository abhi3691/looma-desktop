export function voiceControl(text: string): "mute" | "dismiss" | undefined {
  const phrase = text
    .trim()
    .replace(/^(?:(?:hi|hey|hello)[,\s]*)?(?:looma|luma|ലൂമ)[,\s.!]*/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (
    /^(?:stop listening|microphone off|mic off|കേൾക്കുന്നത് നിർത്തൂ)$/i.test(
      phrase,
    )
  )
    return "mute";
  if (/^(?:stop|end conversation|bye|goodbye|നിർത്തൂ|മതി)$/i.test(phrase))
    return "dismiss";
}
