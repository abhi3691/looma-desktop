const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function linkedText(text: string): string {
  let out = "",
    cursor = 0;
  for (const match of text.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)) {
    out += escape(text.slice(cursor, match.index));
    try {
      const url = new URL(match[2]);
      out +=
        '<a data-source href="' +
        escape(url.href) +
        '">' +
        escape(match[1]) +
        "</a>";
    } catch {
      out += escape(match[0]);
    }
    cursor = match.index! + match[0].length;
  }
  return out + escape(text.slice(cursor));
}
export function replyHTML(text: string): string {
  if (
    text.startsWith("Source:") &&
    /\n\n\s*[\[{]/.test(text) &&
    /"[a-zA-Z_]+"\s*:/.test(text)
  ) {
    return '<p class="reply-text">This older service result was saved before formatted replies. Ask Looma again to see an updated task table.</p>';
  }
  const lines = text.split("\n");
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, "|"));
  const html: string[] = [];
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) {
      html.push(
        '<div class="reply-text">' + linkedText(plain.join("\n")) + "</div>",
      );
      plain = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("### ")) {
      flush();
      html.push(
        '<h4 class="reply-project">' + escape(lines[i].slice(4)) + "</h4>",
      );
      continue;
    }
    if (
      lines[i].trim().startsWith("|") &&
      /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[i + 1] ?? "")
    ) {
      flush();
      const headers = cells(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      i--;
      html.push(
        '<div class="reply-table-wrap"><table class="reply-table"><thead><tr>' +
          headers.map((c) => "<th>" + escape(c) + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows
            .map(
              (row) =>
                "<tr>" +
                headers
                  .map((_, j) => "<td>" + escape(row[j] ?? "—") + "</td>")
                  .join("") +
                "</tr>",
            )
            .join("") +
          "</tbody></table></div>",
      );
    } else plain.push(lines[i]);
  }
  flush();
  return html.join("");
}
export function spokenReply(text: string): string {
  return text
    .replace(
      /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})[\uFE0E\uFE0F\u200D\p{Emoji_Modifier}]*/gu,
      "",
    )
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, "")
    .replace(/^\|\s*[-:|\s]+$/gm, "")
    .replace(/^\|\s*Task\s*\|.*$/gm, "")
    .replace(/^### /gm, "")
    .replace(/\[([^\]]+)\]\(https:\/\/[^)]+\)/g, "$1")
    .replace(/\|/g, ", ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 1500);
}
