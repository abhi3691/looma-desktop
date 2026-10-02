export function voiceControl(text: string): "mute" | "dismiss" | "pause" | "resume" | undefined {
  const phrase = text
    .trim()
    .replace(/^(?:(?:hi|hey|hello)[,\s]*)?(?:looma|luma|ലൂമ)[,\s.!]*/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (/^(?:continue|contine|continue speaking|continue your (?:answer|reply)|resume|resume speaking|go on|keep going|തുടരൂ|തുടരുക|തുടർന്നോളൂ)$/i.test(phrase)) return "resume";
  if (/^(?:pause|pause speaking|wait|hold on|one second|നിർത്തിവെക്കൂ|ഒന്നു നിൽക്കൂ)$/i.test(phrase)) return "pause";
  if (
    /^(?:stop listening|microphone off|mic off|കേൾക്കുന്നത് നിർത്തൂ)$/i.test(
      phrase,
    )
  )
    return "mute";
  if (/^(?:stop|end conversation|bye|goodbye|നിർത്തൂ|മതി)$/i.test(phrase))
    return "dismiss";
}
