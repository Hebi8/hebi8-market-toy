// Compact storage of one-minute bars. Prices are integers (1/1000 yen) and
// almost every number in a bar is a small difference from the one before, so
// each is written as a variable-length integer:
//
//   count, time of the first bar in minutes since the epoch, its open, then
//   per bar: minutes skipped since the previous bar (0 = the next minute),
//            open − previous close (signed), high − max(open, close),
//            min(open, close) − low, close − open (signed)
//
// About five bytes a bar. Files carry it as base64 inside JSON.

const zigzag = (value) => (value < 0 ? -2 * value - 1 : 2 * value);
const unzigzag = (value) => (value % 2 ? -(value + 1) / 2 : value / 2);

function writeVarint(out, value) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`cannot encode ${value}`);
  while (value >= 0x80) {
    out.push((value % 0x80) | 0x80);
    value = Math.floor(value / 0x80);
  }
  out.push(value);
}

/** `bars`: `{ t, o, h, l, c }` with t in unix seconds on whole minutes and integer prices. */
export function encodeBars(bars) {
  const out = [];
  writeVarint(out, bars.length);
  if (!bars.length) return Uint8Array.from(out);
  writeVarint(out, bars[0].t / 60);
  writeVarint(out, bars[0].o);
  let minute = bars[0].t / 60 - 1;
  let close = bars[0].o;
  for (const bar of bars) {
    const at = bar.t / 60;
    writeVarint(out, at - minute - 1);
    writeVarint(out, zigzag(bar.o - close));
    writeVarint(out, bar.h - Math.max(bar.o, bar.c));
    writeVarint(out, Math.min(bar.o, bar.c) - bar.l);
    writeVarint(out, zigzag(bar.c - bar.o));
    minute = at;
    close = bar.c;
  }
  return Uint8Array.from(out);
}

/** Inverse of `encodeBars`; `scale` turns the stored integers into prices (1000 → yen). */
export function decodeBars(bytes, scale = 1) {
  let at = 0;
  const read = () => {
    let value = 0;
    let factor = 1;
    for (;;) {
      if (at >= bytes.length) throw new Error("truncated bar data");
      const byte = bytes[at++];
      value += (byte & 0x7f) * factor;
      if (byte < 0x80) return value;
      factor *= 0x80;
    }
  };
  const count = read();
  const bars = [];
  if (!count) return bars;
  let minute = read() - 1;
  let close = read();
  for (let i = 0; i < count; i++) {
    minute += read() + 1;
    const o = close + unzigzag(read());
    const up = read();
    const down = read();
    const c = o + unzigzag(read());
    bars.push({ t: minute * 60, o: o / scale, h: (Math.max(o, c) + up) / scale, l: (Math.min(o, c) - down) / scale, c: c / scale });
    close = c;
  }
  if (at !== bytes.length) throw new Error("trailing bytes after bar data");
  return bars;
}

export function toBase64(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function fromBase64(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
