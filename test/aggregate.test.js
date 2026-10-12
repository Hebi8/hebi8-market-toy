import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, bucketStart, merge } from "../src/engine/aggregate.js";
import { decodeBars, encodeBars, fromBase64, toBase64 } from "../src/engine/codec.js";

const T0 = Date.UTC(2022, 8, 22, 8, 0) / 1000;
const minute = (offset, o, h, l, c) => ({ t: T0 + offset * 60, o, h, l, c });

test("buckets start on multiples of the period", () => {
  assert.equal(bucketStart(T0 + 7 * 60, 5), T0 + 5 * 60);
  assert.equal(bucketStart(T0 + 14 * 60, 15), T0);
  assert.equal(bucketStart(T0 + 15 * 60, 15), T0 + 15 * 60);
});

test("five one-minute bars become one five-minute bar; a gap does not bridge buckets", () => {
  const bars = [
    minute(0, 145.5, 145.6, 145.4, 145.55),
    minute(1, 145.55, 145.9, 145.5, 145.8),
    minute(2, 145.8, 145.85, 144.9, 145),
    minute(4, 145, 145.1, 144.5, 144.6),
    // Minutes 5–8 missing.
    minute(9, 143, 143.2, 142.8, 143.1),
    minute(10, 143.1, 143.3, 143, 143.2),
  ];
  assert.deepEqual(aggregate(bars, 5), [
    { t: T0, o: 145.5, h: 145.9, l: 144.5, c: 144.6 },
    { t: T0 + 300, o: 143, h: 143.2, l: 142.8, c: 143.1 },
    { t: T0 + 600, o: 143.1, h: 143.3, l: 143, c: 143.2 },
  ]);
  assert.deepEqual(aggregate(bars, 15), [{ t: T0, o: 145.5, h: 145.9, l: 142.8, c: 143.2 }]);
  assert.deepEqual(aggregate(bars, 1), bars);
});

test("feeding bars one at a time gives the same series and returns the forming bar", () => {
  const bars = Array.from({ length: 37 }, (_, i) => minute(i, 100 + i, 101 + i, 99 + i, 100.5 + i));
  const series = [];
  let last;
  for (const bar of bars) last = merge(series, bar, 15);
  assert.deepEqual(series, aggregate(bars, 15));
  assert.equal(last, series[series.length - 1]);
  assert.equal(last.t, T0 + 30 * 60);
  assert.equal(last.c, 136.5);
});

test("the bar codec round-trips gaps, falls and jumps, and stays small", () => {
  const bars = [
    { t: T0, o: 145_500, h: 145_610, l: 145_400, c: 145_550 },
    { t: T0 + 60, o: 145_548, h: 145_548, l: 143_100, c: 143_300 },
    { t: T0 + 120, o: 143_300, h: 143_300, l: 143_300, c: 143_300 },
    // Weekend gap, then a jump up at the reopening.
    { t: T0 + 60 * 60 * 49, o: 146_020, h: 146_500, l: 146_000, c: 146_480 },
  ];
  const bytes = encodeBars(bars);
  assert.ok(bytes.length < 40);
  assert.deepEqual(decodeBars(bytes), bars);
  assert.deepEqual(decodeBars(fromBase64(toBase64(bytes)), 1000)[1], { t: T0 + 60, o: 145.548, h: 145.548, l: 143.1, c: 143.3 });
  assert.deepEqual(decodeBars(encodeBars([])), []);
  assert.throws(() => decodeBars(bytes.subarray(0, bytes.length - 1)), /truncated/);
});
