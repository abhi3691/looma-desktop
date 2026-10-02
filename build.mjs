import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.ts", "src/preload.ts", "src/workspace-preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  external: ["electron", "sql.js"],
});
await build({
  entryPoints: ["src/renderer.ts"],
  bundle: true,
  platform: "browser",
  loader: {".glb":"binary"},
  outfile: "dist/renderer.js",
});
await copyFile("public/index.html", "dist/index.html");
await copyFile("public/style.css", "dist/style.css");
