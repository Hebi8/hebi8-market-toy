// Downloads the year files the scenarios need into raw/histdata/, the way the
// site's own download page does it: read the form token from the year page,
// then post the form. One file at a time with a pause in between; files
// already on disk are kept. Anything unexpected stops the run. It is someone
// else's free service: never retried around, never run in parallel.
//
//   node scripts/fetch-histdata.mjs              # what scenarios.mjs needs
//   node scripts/fetch-histdata.mjs 2008 2011    # these years, all pairs
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DOWNLOAD_URL, rawPath, yearPage } from "./histdata.mjs";
import { PAIRS, SCENARIOS, scenarioYears } from "./scenarios.mjs";

const PAUSE_MS = 6000;
const AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const wanted = new Set();
const years = process.argv.slice(2);
if (years.length) for (const year of years) for (const pair of PAIRS) wanted.add(`${pair} ${year}`);
else for (const scenario of SCENARIOS) for (const year of scenarioYears(scenario)) for (const pair of scenario.pairs ?? PAIRS) wanted.add(`${pair} ${year}`);

let fetched = 0;
let kept = 0;
for (const item of [...wanted].sort()) {
  const [pair, year] = item.split(" ");
  const file = rawPath(pair, year);
  if (existsSync(file)) {
    kept++;
    continue;
  }
  if (fetched) await sleep(PAUSE_MS);
  const page = yearPage(pair, year);
  const html = await fetch(page, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(60_000) });
  if (html.status !== 200) stop(`${item}: page answered HTTP ${html.status}`);
  const token = /name="tk" id="tk" value="([0-9a-f]+)"/.exec(await html.text())?.[1];
  // Only finished years have a year file; the running year is split by month.
  if (!token) stop(`${item}: no download token on ${page}`);
  await sleep(2000);
  const body = new URLSearchParams({ tk: token, date: year, datemonth: year, platform: "ASCII", timeframe: "M1", fxpair: pair });
  const response = await fetch(DOWNLOAD_URL, {
    method: "POST",
    headers: { "user-agent": AGENT, referer: page, "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(300_000),
  });
  const zip = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200 || zip.length < 1000 || zip.readUInt32LE(0) !== 0x04034b50) {
    stop(`${item}: download answered HTTP ${response.status} with ${zip.length} bytes that are not a zip`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, zip);
  fetched++;
  console.log(`${item}: ${(zip.length / 1e6).toFixed(1)} MB`);
}
console.log(`Fetched ${fetched} year files, ${kept} already present.`);

function stop(message) {
  console.error(`${message}. Stopping; run again later.`);
  process.exit(1);
}
