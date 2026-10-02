import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed, internetIntent, searchReply } from "../src/internet";
import { replyHTML, spokenReply } from "../src/reply-view";
import { encodeWav } from "../src/audio";
import { melodyWave, wantsSong } from "../src/song";
test("search feeds preserve attribution and reject unsafe links", () => {
  const hits = parseFeed(
    "<rss><item><title>Today &amp; tomorrow</title><link>https://example.com/news</link><description>&lt;b&gt;A fact&lt;/b&gt;</description><pubDate>Thu, 01 Oct 2026 04:00:00 GMT</pubDate></item><item><title>Bad</title><link>javascript:alert(1)</link></item></rss>",
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].summary, "A fact");
  const text = searchReply(hits, true);
  assert.match(
    replyHTML(text),
    /data-source href="https:\/\/example.com\/news"/,
  );
  assert.doesNotMatch(spokenReply(text), /https:/);
  assert.equal(internetIntent("What is the news today?"), "news");
  assert.equal(internetIntent("search online for Gandhi Jayanti"), "search");
  assert.equal(internetIntent("hello"), undefined);
});
test("original song combines voice phrases as a bounded musical WAV", () => {
  const samples = Float32Array.from(
    { length: 16000 },
    (_, i) => Math.sin(i * 0.09) * 0.2,
  );
  const song = melodyWave([encodeWav([samples]), encodeWav([samples])]);
  assert.equal(new DataView(song.buffer).getUint32(24, true), 22050);
  assert(song.length > 44000 && song.length < 220500);
  assert(wantsSong("sing a song"));
  assert(wantsSong("പാട്ട് പാടൂ"));
  assert(!wantsSong("what are my tasks?"));
});
