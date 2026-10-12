// Looks at downloaded minutes to choose and check scenario windows:
//
//   node scripts/inspect-days.mjs 2022-09-21 2022-09-23        # per UTC day
//   node scripts/inspect-days.mjs 2022-09-21 2022-09-23 60     # and per 60 minutes
//
// Prints high, low and range per pair, the hour with the largest range, and
// the 10-hour window with the largest range in the whole span.
import { PRICE_SCALE, readYear } from "./histdata.mjs";
import { PAIRS } from "./scenarios.mjs";

const [first, last = first, step] = process.argv.slice(2);
if (!first) throw new Error("usage: inspect-days.mjs <first day> [last day] [minutes per row]");
const from = Date.parse(`${first}T00:00:00Z`) / 1000;
const to = Date.parse(`${last}T00:00:00Z`) / 1000 + 86_400;
const price = (value) => (value / PRICE_SCALE).toFixed(3);
const stamp = (time) => new Date(time * 1000).toISOString().slice(0, 16).replace("T", " ");

for (const pair of PAIRS) {
  let bars = [];
  for (let year = Number(first.slice(0, 4)); year <= Number(last.slice(0, 4)); year++) {
    const { bars: all, clock } = readYear(pair, year);
    console.log(`${pair} ${year}: file clock ${clock}`);
    bars = bars.concat(all.filter((bar) => bar.t >= from && bar.t < to));
  }
  console.log(`\n${pair}: ${bars.length} quoted minutes`);
  const rows = new Map();
  const size = step ? Number(step) * 60 : 86_400;
  for (const bar of bars) {
    const key = bar.t - (bar.t % size);
    const row = rows.get(key) ?? rows.set(key, { o: bar.o, h: bar.h, l: bar.l, c: bar.c, n: 0, hour: new Map() }).get(key);
    row.h = Math.max(row.h, bar.h);
    row.l = Math.min(row.l, bar.l);
    row.c = bar.c;
    row.n++;
    const hour = bar.t - (bar.t % 3600);
    const h = row.hour.get(hour) ?? row.hour.set(hour, { h: bar.h, l: bar.l }).get(hour);
    h.h = Math.max(h.h, bar.h);
    h.l = Math.min(h.l, bar.l);
  }
  for (const [key, row] of rows) {
    const [busiest, range] = [...row.hour].map(([hour, v]) => [hour, v.h - v.l]).sort((a, b) => b[1] - a[1])[0];
    console.log(
      `  ${stamp(key)}  n=${String(row.n).padStart(4)}  o ${price(row.o)}  h ${price(row.h)}  l ${price(row.l)}  c ${price(row.c)}` +
      `  range ${price(row.h - row.l)} (${(((row.h - row.l) / row.o) * 100).toFixed(2)}%)` +
      (step ? "" : `  busiest hour ${stamp(busiest).slice(11)} ${price(range)}`),
    );
  }
  // Largest high–low over any 10 hours, sliding by 15 minutes.
  let best = null;
  for (let start = from; start + 36_000 <= to; start += 900) {
    const window = bars.filter((bar) => bar.t >= start && bar.t < start + 36_000);
    if (window.length < 300) continue;
    const range = Math.max(...window.map((bar) => bar.h)) - Math.min(...window.map((bar) => bar.l));
    if (!best || range > best.range) best = { start, range, n: window.length };
  }
  if (best) console.log(`  widest 10 h: from ${stamp(best.start)}  range ${price(best.range)}  (${best.n} minutes)`);
}
