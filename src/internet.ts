export type SearchHit = {
  title: string;
  url: string;
  summary: string;
  published?: string;
};
const decode = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
export function parseFeed(xml: string): SearchHit[] {
  const field = (block: string, name: string) =>
    decode(
      block.match(
        new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"),
      )?.[1] ?? "",
    );
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .slice(0, 40)
    .flatMap((m) => {
      const title = field(m[1], "title"),
        url = field(m[1], "link");
      try {
        if (new URL(url).protocol !== "https:" || !title) return [];
      } catch {
        return [];
      }
      return [
        {
          title: title.slice(0, 240),
          url,
          summary: field(m[1], "description").slice(0, 800),
          published: field(m[1], "pubDate") || undefined,
        },
      ];
    });
}
export function internetIntent(text: string): "news" | "search" | undefined {
  if (/\bnews\b|വാർത്ത|vartha|vaartha/i.test(text)) return "news";
  if (
    /^(?:please\s+)?(?:search|look up|google|find online)\b|\b(?:latest|current weather|weather today)\b|ഇന്റർനെറ്റിൽ|തിരയൂ/i.test(
      text,
    )
  )
    return "search";
}
export async function internetSearch(
  query: string,
  news: boolean,
): Promise<SearchHit[]> {
  const topic = query
    .replace(/^(?:hi|hey)\s+looma[,\s]*/i, "")
    .replace(
      /\b(?:please|tell me|what is|what are|the|today'?s?|latest|news|headlines|search|online)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const url = new URL(
    news
      ? topic
        ? "https://news.google.com/rss/search"
        : "https://news.google.com/rss"
      : "https://www.bing.com/search",
  );
  url.searchParams.set(
    "q",
    news ? (topic || "India world") + " when:1d" : query.slice(0, 500),
  );
  if (news) {
    url.searchParams.set("hl", "en-IN");
    url.searchParams.set("gl", "IN");
    url.searchParams.set("ceid", "IN:en");
  } else url.searchParams.set("format", "rss");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { "User-Agent": "CarelessAI/0.1 (user-requested search)" },
  });
  if (!response.ok) throw Error("Search service unavailable");
  const xml = await response.text();
  if (xml.length > 2000000) throw Error("Search response too large");
  const hits = parseFeed(xml);
  return hits
    .filter(
      (h) =>
        !news ||
        !/facebook\.com|youtube\.com|instagram\.com|tiktok\.com/i.test(h.title),
    )
    .filter(
      (h) =>
        !news ||
        (!!h.published &&
          Date.now() - Date.parse(h.published) >= 0 &&
          Date.now() - Date.parse(h.published) <= 86400000),
    )
    .slice(0, 6);
}
export function searchReply(hits: SearchHit[], news: boolean): string {
  if (!hits.length)
    return news
      ? "I could not verify any news from the past 24 hours. Please try another topic."
      : "No search results were available. Try a more specific question.";
  return (
    `### ${news ? "Latest news · past 24 hours" : "Internet search"}\nChecked ${new Date().toLocaleString()}\n\n` +
    hits
      .map(
        (h, i) =>
          `${i + 1}. [${h.title.replace(/[\[\]]/g, "")}](${h.url})${h.published ? " — " + new Date(h.published).toLocaleString() : ""}\n${h.summary && h.summary !== h.title ? h.summary + "\n" : ""}`,
      )
      .join("\n")
  );
}
