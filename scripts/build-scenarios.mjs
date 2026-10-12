// Turns the downloaded year files into what the game ships: one compact file
// per scenario × pair under public/data/ and an index of them. Nothing here
// invents a price: a pair that lacks the minutes of a scenario, or that hardly
// moved in it, is left out of that scenario.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PRICE_SCALE, readYear } from "./histdata.mjs";
import { PAIRS, SCENARIOS, scenarioYears, seconds } from "./scenarios.mjs";
import { decodeBars, encodeBars, toBase64 } from "../src/engine/codec.js";

const OUT = fileURLToPath(new URL("../public/data/", import.meta.url));
/** A scenario is only worth replaying for a pair that moved at least this much in it (high − low over the open). */
const MIN_RANGE_PCT = 1.5;
/** Fewer quoted minutes than this share of the window means the data is too thin to play. */
const MIN_COVERAGE = 0.6;
const ANCHOR_REACH = 3 * 3600;
const ANCHOR_EARLY = 60;
const ANCHOR_LATE = 6 * 60;

const stamp = (time) => new Date(time * 1000).toISOString().slice(0, 16).replace("T", " ");
const yenOf = (value) => value / PRICE_SCALE;

function barsBetween(pair, scenario, from, to) {
  let bars = [];
  const clocks = new Set();
  for (const year of scenarioYears(scenario)) {
    const file = readYear(pair, year);
    clocks.add(file.clock);
    bars = bars.concat(file.bars.filter((bar) => bar.t >= from && bar.t < to));
  }
  return { bars, clock: [...clocks].join("+") };
}

function checkAnchor(scenario) {
  const at = seconds(scenario.anchor);
  const { bars } = barsBetween("USDJPY", scenario, at - ANCHOR_REACH, at + ANCHOR_REACH);
  const sharpest = bars.reduce((a, b) => (b.h - b.l > a.h - a.l ? b : a));
  if (sharpest.t < at - ANCHOR_EARLY || sharpest.t > at + ANCHOR_LATE) {
    throw new Error(`${scenario.id}: the sharpest minute near the anchor is ${stamp(sharpest.t)}, not ${stamp(at)}; the timestamps do not match the reports of the day`);
  }
  return sharpest;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const index = { source: "HistData.com", granularity: 1, pairs: PAIRS, scenarios: [] };
let total = 0;
for (const scenario of SCENARIOS) {
  const context = seconds(scenario.context);
  const from = seconds(scenario.from);
  const to = seconds(scenario.to);
  console.log(`${scenario.id}: ${scenario.from} to ${scenario.to}`);
  if (scenario.anchor) {
    const minute = checkAnchor(scenario);
    console.log(`  anchor ${stamp(seconds(scenario.anchor))} ok: the sharpest minute nearby is ${stamp(minute.t)}, ${yenOf(minute.h - minute.l).toFixed(3)} yen`);
  }
  const entry = { id: scenario.id, date: scenario.date, title: scenario.title, blurb: scenario.blurb, pairs: {} };
  for (const pair of scenario.pairs ?? PAIRS) {
    const { bars, clock } = barsBetween(pair, scenario, context, to);
    const lead = bars.findIndex((bar) => bar.t >= from);
    const played = lead < 0 ? [] : bars.slice(lead);
    const coverage = played.length / ((to - from) / 60);
    if (lead < 200 || coverage < MIN_COVERAGE) {
      console.log(`  ${pair}: left out, ${lead} minutes of context and ${(coverage * 100).toFixed(0)}% of the window quoted`);
      continue;
    }
    const high = Math.max(...played.map((bar) => bar.h));
    const low = Math.min(...played.map((bar) => bar.l));
    const rangePct = ((high - low) / played[0].o) * 100;
    if (rangePct < MIN_RANGE_PCT) {
      console.log(`  ${pair}: left out, it only moved ${rangePct.toFixed(2)}% in the window`);
      continue;
    }
    let gap = 0;
    for (let i = 1; i < played.length; i++) gap = Math.max(gap, (played[i].t - played[i - 1].t) / 60 - 1);

    const bytes = encodeBars(bars);
    // What is written must read back as exactly what was downloaded.
    const back = decodeBars(bytes);
    if (back.length !== bars.length || back.some((bar, i) => ["t", "o", "h", "l", "c"].some((key) => bar[key] !== bars[i][key]))) {
      throw new Error(`${scenario.id} ${pair}: the encoded bars do not decode to the source`);
    }
    const file = `${scenario.id}.${pair}.json`;
    const text = JSON.stringify({ id: scenario.id, pair, scale: PRICE_SCALE, context: lead, bars: toBase64(bytes) });
    await writeFile(`${OUT}${file}`, `${text}\n`);
    total += text.length;
    entry.pairs[pair] = {
      file,
      bars: bars.length,
      context: lead,
      from: played[0].t,
      to: played[played.length - 1].t + 60,
      open: yenOf(played[0].o),
      high: yenOf(high),
      low: yenOf(low),
      close: yenOf(played[played.length - 1].c),
      range: yenOf(high - low),
      rangePct: Number(rangePct.toFixed(2)),
    };
    console.log(
      `  ${pair}: ${lead} + ${played.length} minutes (${(coverage * 100).toFixed(0)}% quoted, longest gap ${gap} min, clock ${clock}), ` +
      `${yenOf(played[0].o).toFixed(3)} → ${yenOf(played[played.length - 1].c).toFixed(3)}, high ${yenOf(high).toFixed(3)}, low ${yenOf(low).toFixed(3)}, ` +
      `range ${yenOf(high - low).toFixed(3)} (${rangePct.toFixed(2)}%), ${(text.length / 1024).toFixed(1)} KB`,
    );
  }
  if (Object.keys(entry.pairs).length) index.scenarios.push(entry);
  else console.log(`${scenario.id}: dropped, no pair has usable data`);
}
await writeFile(`${OUT}index.json`, `${JSON.stringify(index, null, 1)}\n`);
console.log(`Wrote ${index.scenarios.length} scenarios, ${(await readdir(OUT)).length - 1} data files, ${(total / 1024).toFixed(0)} KB.`);
