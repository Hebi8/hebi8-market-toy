// Scenario data ships inside the package: an index and one file per
// scenario × pair, fetched from the package's own directory when needed.
import { decodeBars, fromBase64 } from "./engine/codec.js";

const cache = new Map();

async function json(path) {
  const response = await fetch(`./data/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

export const loadIndex = () => json("index.json");

/**
 * `{ bars, context }`: every one-minute bar of the scenario for this pair and
 * how many of them are on the chart before the replay starts.
 */
export function loadBars(scenario, pair) {
  const file = scenario.pairs[pair].file;
  if (!cache.has(file)) {
    cache.set(file, json(file).then((data) => ({
      bars: decodeBars(fromBase64(data.bars), data.scale),
      context: data.context,
    })).catch((error) => {
      cache.delete(file);
      throw error;
    }));
  }
  return cache.get(file);
}
