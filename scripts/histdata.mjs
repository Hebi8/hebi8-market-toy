// HistData.com free one-minute bars ("Generic ASCII, M1"): one zip per pair
// per past year. Shared by the fetch and the scenario build scripts.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const RAW_DIR = fileURLToPath(new URL("../raw/histdata/", import.meta.url));
/** Prices are stored as integers in 1/1000 yen. */
export const PRICE_SCALE = 1000;

export const yearPage = (pair, year) =>
  `https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/${pair.toLowerCase()}/${year}`;
export const DOWNLOAD_URL = "https://www.histdata.com/get.php";
export const rawPath = (pair, year) => `${RAW_DIR}${pair}/${year}.zip`;

const sunday = (year, month, nth) => {
  // nth > 0: the nth Sunday of the month; nth = -1: the last one.
  if (nth < 0) {
    const end = new Date(Date.UTC(year, month + 1, 0));
    return Date.UTC(year, month, end.getUTCDate() - end.getUTCDay());
  }
  const first = new Date(Date.UTC(year, month, 1));
  return Date.UTC(year, month, 1 + ((7 - first.getUTCDay()) % 7) + 7 * (nth - 1));
};

/**
 * Hours to add to a timestamp in the files to get UTC. The site calls its
 * clock "EST without daylight saving", but the files do move with daylight
 * time, and not all by the same calendar: older years follow New York
 * (second Sunday of March to first Sunday of November), newer ones follow
 * Europe's dates (last Sunday of March to last Sunday of October). Which one
 * a file uses is decided by `readYear` from the file itself.
 */
export const CLOCKS = {
  newYork: (year, date) => (date >= sunday(year, 2, 2) && date < sunday(year, 10, 1) ? 4 : 5),
  europe: (year, date) => (date >= sunday(year, 2, -1) && date < sunday(year, 9, -1) ? 4 : 5),
};

const toInt = (text) => Math.round(Number(text) * PRICE_SCALE);

/** Rows of a year file with the file's own wall clock: `{ year, date, minute, o, h, l, c }`. */
function readRows(pair, year) {
  const file = rawPath(pair, year);
  if (!existsSync(file)) throw new Error(`${file} is missing: run npm run data:fetch`);
  const csv = execFileSync("python3", ["-c", `
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
sys.stdout.buffer.write(z.read(next(n for n in z.namelist() if n.endswith('.csv'))))
`, file], { maxBuffer: 1 << 27 }).toString("latin1");
  const rows = [];
  const recent = new Map();
  let from = 0;
  while (from < csv.length) {
    let to = csv.indexOf("\n", from);
    if (to < 0) to = csv.length;
    const line = csv.slice(from, to).trim();
    from = to + 1;
    if (!line) continue;
    // 20220922 040400;145.064000;145.067000;143.892000;144.271000;0
    const [stamp, o, h, l, c] = line.split(";");
    const y = Number(stamp.slice(0, 4));
    const date = Date.UTC(y, Number(stamp.slice(4, 6)) - 1, Number(stamp.slice(6, 8)));
    const row = { year: y, date, minute: Number(stamp.slice(9, 11)) * 60 + Number(stamp.slice(11, 13)), o: toInt(o), h: toInt(h), l: toInt(l), c: toInt(c) };
    if (!(row.l > 0) || row.l > Math.min(row.o, row.c) || row.h < Math.max(row.o, row.c)) {
      throw new Error(`${pair} ${year}: inconsistent bar "${line}"`);
    }
    const local = date / 60_000 + row.minute;
    const last = rows[rows.length - 1];
    if (last && local <= last.date / 60_000 + last.minute) {
      // On a Sunday the clocks go back the files repeat one hour, row for
      // row. A repeat of a bar already read is dropped; anything else is not
      // something to guess about.
      const seen = recent.get(local);
      if (seen && seen.o === row.o && seen.h === row.h && seen.l === row.l && seen.c === row.c) continue;
      throw new Error(`${pair} ${year}: time goes backwards at "${line}"`);
    }
    recent.set(local, row);
    if (recent.size > 240) recent.delete(recent.keys().next().value);
    rows.push(row);
  }
  return rows;
}

/** Hours New York is behind UTC at `time` (unix seconds). */
const newYorkHour = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" });
const newYorkOffset = (time) => (new Date(time * 1000).getUTCHours() - Number(newYorkHour.format(time * 1000)) + 24) % 24;

/**
 * The market closes on Friday 17:00 New York time and opens again on Sunday
 * at the same hour. New York and Europe change their clocks on different
 * Sundays, so with the wrong clock some week of the year starts before 17:00
 * or ends after it. Returns the number of weekends that were looked at, or
 * the first violation as a string.
 */
export function checkWeekends(bars) {
  let weekends = 0;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].t - bars[i - 1].t < 40 * 3600) continue;
    weekends++;
    for (const [bar, edge] of [[bars[i], "opens"], [bars[i - 1], "closes"]]) {
      const local = new Date((bar.t - newYorkOffset(bar.t) * 3600) * 1000);
      const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
      // Holidays aside (late opens, early closes), no quote lies across 17:00.
      const fine = edge === "opens" ? minutes >= 17 * 60 || local.getUTCDay() !== 0 : minutes <= 17 * 60 || local.getUTCDay() !== 5;
      if (!fine) return `week ${edge} at ${new Date(bar.t * 1000).toISOString()}, across 17:00 New York`;
    }
  }
  return weekends;
}

const read = new Map();
/**
 * The quoted minutes of one year, `{ t, o, h, l, c }` with `t` in unix seconds
 * (UTC) and integer prices, plus the clock the file turned out to use.
 * Minutes without a quote are simply not in the file.
 */
export function readYear(pair, year) {
  const key = `${pair} ${year}`;
  if (read.has(key)) return read.get(key);
  const rows = readRows(pair, year);
  const fits = [];
  const problems = [];
  for (const [clock, offset] of Object.entries(CLOCKS)) {
    const bars = rows.map((row) => ({ t: row.date / 1000 + (row.minute + offset(row.year, row.date) * 60) * 60, o: row.o, h: row.h, l: row.l, c: row.c }));
    const weekends = checkWeekends(bars);
    if (typeof weekends === "number" && weekends >= 40) fits.push({ clock, bars, weekends });
    else problems.push(`${clock}: ${weekends}`);
  }
  // Exactly one clock may fit; otherwise the timestamps cannot be trusted.
  if (fits.length !== 1) throw new Error(`${key}: cannot tell the file's clock (${problems.join("; ") || "both fit"})`);
  read.set(key, fits[0]);
  return fits[0];
}
