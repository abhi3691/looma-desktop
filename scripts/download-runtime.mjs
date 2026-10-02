import { mkdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
if (process.platform !== "darwin")
  throw Error(
    "On Windows, install Ollama from https://ollama.com/download/windows, then select its executable in Settings.",
  );
await mkdir("runtime/ollama-darwin", { recursive: true });
const response = await fetch(
  "https://github.com/ollama/ollama/releases/download/v0.34.0/ollama-darwin.tgz",
);
if (!response.ok) throw Error("Could not download Ollama");
const bytes = Buffer.from(await response.arrayBuffer());
const expected =
  "dd12b00bcce2d6551178e67ada90d5af9f75bdb54a118b96655250fa3e8ef734";
if (createHash("sha256").update(bytes).digest("hex") !== expected)
  throw Error("Ollama checksum mismatch");
await writeFile("runtime/ollama-darwin.tgz", bytes);
execFileSync("/usr/bin/tar", [
  "-xzf",
  "runtime/ollama-darwin.tgz",
  "-C",
  "runtime/ollama-darwin",
]);
await rm("runtime/ollama-darwin.tgz");
console.log(
  "Verified Ollama runtime is ready for local use and macOS packaging.",
);
