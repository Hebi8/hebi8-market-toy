// Chart periods above one minute are built from the one-minute bars.
// A bucket starts on a multiple of the period counted from the unix epoch,
// so 5 and 15 minute bars sit on :00, :05, … like on any terminal.

export const bucketStart = (time, minutes) => time - (time % (minutes * 60));

/** Bars `{ t, o, h, l, c }` (t in unix seconds, ascending) in buckets of `minutes`. */
export function aggregate(bars, minutes) {
  if (minutes === 1) return bars.map((bar) => ({ ...bar }));
  const out = [];
  for (const bar of bars) merge(out, bar, minutes);
  return out;
}

/**
 * Adds one more one-minute bar to an aggregated series in place: it either
 * extends the last bucket or starts the next. Returns the bucket it went into.
 */
export function merge(series, bar, minutes) {
  const t = bucketStart(bar.t, minutes);
  const last = series[series.length - 1];
  if (last && last.t === t) {
    if (bar.h > last.h) last.h = bar.h;
    if (bar.l < last.l) last.l = bar.l;
    last.c = bar.c;
    return last;
  }
  const next = { t, o: bar.o, h: bar.h, l: bar.l, c: bar.c };
  series.push(next);
  return next;
}
