// What must hold before a package is built: the sources parse, the page only
// refers to files that ship, nothing in it reaches for another host or leaks
// a path of this machine, the wording stays within the rules of the platform,
// and every scenario file decodes to sane bars.
import assert from "node:assert/strict";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { bundle } from "./bundle.mjs";
import { decodeBars, fromBase64 } from "../src/engine/codec.js";
import { RULES } from "../src/engine/rules.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const pub = `${root}public/`;
/**
 * The only addresses the package may name, both Bilibili's own: the Toy SDK
 * (loaded on Bilibili's hosts alone) and the author's space, which the
 * "作者主页" button opens when there is no container to navigate with.
 */
const ALLOWED_URLS = new Set([
  "https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js",
  "https://space.bilibili.com/66384529",
]);
/** Namespaces are identifiers, not requests. */
const NAMESPACE = /^http:\/\/www\.w3\.org\//;
const LIMIT_BYTES = 10 * 1024 * 1024;
// The game is a simulation: no account opening, brokers, deposits or real trading anywhere in it.
const FORBIDDEN_WORDING = /开户|券商|经纪商|交易商|入金|出金|实盘|真实交易|跟单|返佣|荐股/;

// 1. Every script parses.
let scripts = 0;
for (const dir of ["src", "scripts", "test"]) {
  for (const name of await readdir(`${root}${dir}`, { recursive: true })) {
    if (!/\.m?js$/.test(name)) continue;
    execFileSync(process.execPath, ["--check", `${root}${dir}/${name}`]);
    scripts++;
  }
}

// 2. The bundle is self-contained.
const app = await bundle();
for (const url of app.match(/https?:\/\/[^"'`\s)\\<]+/g) ?? []) {
  assert(ALLOWED_URLS.has(url) || NAMESPACE.test(url), `app.js names ${url}`);
}
for (const [what, pattern] of [
  ["a source map", /sourceMappingURL/],
  ["a path of this machine", /\/home\/|\/Users\/|[A-Z]:\\\\Users/],
  ["a local address", /localhost|127\.0\.0\.1/],
  ["a network API the game has no use for", /XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts/],
  ["a dynamic import", /\bimport\(/],
]) assert(!pattern.test(app), `app.js contains ${what}`);
// The one fetch is the scenario loader, and it stays inside the package.
assert.equal(app.split("fetch(").length - 1, 1, "app.js should fetch in exactly one place");
assert(/fetch\(`\.\/data\//.test(app), "the scenario loader must fetch a relative ./data/ path");

// The up and down colours are the player's choice: written down in src/theme.js and nowhere else.
const theme = await readFile(`${root}src/theme.js`, "utf8");
const paletteColours = [...new Set(theme.match(/#[0-9a-f]{6}\b/gi))];
assert(paletteColours.length >= 4, "src/theme.js should define the palette");
for (const name of [...(await readdir(`${root}src`, { recursive: true })).map((file) => `src/${file}`), "public/styles.css", "public/index.html"]) {
  if (name === "src/theme.js" || !/\.(js|css|html)$/.test(name)) continue;
  const text = await readFile(`${root}${name}`, "utf8");
  for (const colour of paletteColours) assert(!text.toLowerCase().includes(colour.toLowerCase()), `${name}: palette colour ${colour} written outside src/theme.js`);
  if (name.endsWith(".css")) assert(!/--(up|down)(-fill|-soft)?\s*:/.test(text), `${name}: sets an up/down colour itself`);
}

// 3. Static files only point at files that ship, never at another host.
let pages = 0;
let bytes = Buffer.byteLength(app);
const texts = [app];
for (const name of await readdir(pub, { recursive: true })) {
  const file = path.join(pub, name);
  const info = await stat(file);
  if (!info.isFile()) continue;
  bytes += info.size;
  assert(/\.(html|css|svg|json)$/.test(name), `${name}: unexpected file type in the package`);
  const text = await readFile(file, "utf8");
  if (!name.endsWith(".json")) texts.push(text);
  if (name.endsWith(".css")) {
    assert(!/@import/.test(text), `${name}: @import`);
    for (const [, reference] of text.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
      assert(!/^(https?:|\/)/.test(reference), `${name}: remote resource ${reference}`);
      if (!reference.startsWith("data:") && !reference.startsWith("#")) await access(path.resolve(path.dirname(file), reference));
    }
  }
  if (name.endsWith(".html")) {
    pages++;
    for (const [, reference] of text.matchAll(/(?:href|src|action)="([^"]+)"/g)) {
      assert(!reference.startsWith("/"), `${name}: absolute path ${reference}`);
      assert(!/^(https?:)?\/\//.test(reference), `${name}: external reference ${reference}`);
      if (reference.startsWith("#")) continue;
      const target = reference.split(/[?#]/)[0];
      // app.js is the bundle checked above; build.mjs writes it next to the page.
      if (target !== "./app.js") await access(path.resolve(path.dirname(file), target));
    }
    assert(text.includes("模拟游戏，历史数据回放，不构成投资建议。"), `${name}: the standing disclaimer is missing`);
  }
}
for (const text of texts) {
  const found = FORBIDDEN_WORDING.exec(text);
  assert(!found, `wording not allowed in the package: ${found?.[0]}`);
}

// 4. The scenario data is what the game expects.
const index = JSON.parse(await readFile(`${pub}data/index.json`, "utf8"));
assert(index.scenarios.length >= 8, "fewer than 8 scenarios");
let files = 0;
for (const scenario of index.scenarios) {
  for (const [pair, entry] of Object.entries(scenario.pairs)) {
    assert(pair in RULES.spread, `${scenario.id}: no spread configured for ${pair}`);
    const data = JSON.parse(await readFile(`${pub}data/${entry.file}`, "utf8"));
    const bars = decodeBars(fromBase64(data.bars), data.scale);
    assert.equal(bars.length, entry.bars, `${entry.file}: bar count`);
    assert.equal(data.context, entry.context, `${entry.file}: context`);
    assert(data.context >= 200 && bars.length - data.context >= 300, `${entry.file}: too short`);
    bars.forEach((bar, i) => {
      assert(bar.t % 60 === 0 && (i === 0 || bar.t > bars[i - 1].t), `${entry.file}: time at bar ${i}`);
      assert(bar.l > 0 && bar.l <= Math.min(bar.o, bar.c) && bar.h >= Math.max(bar.o, bar.c), `${entry.file}: prices at bar ${i}`);
    });
    const played = bars.slice(data.context);
    assert.equal(played[0].t, entry.from, `${entry.file}: start`);
    assert.equal(Math.max(...played.map((bar) => bar.h)), entry.high, `${entry.file}: high`);
    assert.equal(Math.min(...played.map((bar) => bar.l)), entry.low, `${entry.file}: low`);
    files++;
  }
}
assert(bytes < LIMIT_BYTES, `package is ${bytes} bytes`);

console.log(
  `Checked ${scripts} scripts, the bundle (${Math.ceil(Buffer.byteLength(app) / 1024)} KB, self-contained), ${pages} page, ` +
  `${index.scenarios.length} scenarios in ${files} data files; ${(bytes / 1024 / 1024).toFixed(2)} MB before compression.`,
);
