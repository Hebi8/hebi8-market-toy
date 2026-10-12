// What is remembered between visits: the best result per scenario × pair,
// a few preferences, and the round in progress. Bests also go to the Toy
// cloud save when there is one; everything else stays in localStorage.
import { cloud } from "./toy.js";

const BEST_KEY = "hebi8fx_best_v1";
const PREFS_KEY = "hebi8fx_prefs_v1";
const ROUND_KEY = "hebi8fx_round_v1";

// Storage can be blocked inside an embedded frame; then this session's memory has to do.
const memory = new Map();
function read(key) {
  try {
    const text = localStorage.getItem(key) ?? memory.get(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return memory.has(key) ? JSON.parse(memory.get(key)) : null;
  }
}
function write(key, value) {
  const text = value == null ? null : JSON.stringify(value);
  if (text == null) memory.delete(key);
  else memory.set(key, text);
  try {
    if (text == null) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
  } catch {
    // Kept in memory only.
  }
}

const bestKey = (scenarioId, pair) => `${scenarioId}|${pair}`;
let bests = read(BEST_KEY) ?? {};

/** Merges the cloud copy into the local one (higher return wins) and writes back what the cloud lacks. */
export async function syncBests() {
  const remote = await cloud.get([BEST_KEY]);
  if (!remote) return false;
  let parsed = remote[BEST_KEY];
  try {
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
  } catch {
    parsed = null;
  }
  let localAhead = false;
  const merged = { ...(parsed && typeof parsed === "object" ? parsed : {}) };
  for (const [key, value] of Object.entries(bests)) {
    if (!(merged[key]?.returnPct >= value.returnPct)) {
      merged[key] = value;
      localAhead = true;
    }
  }
  bests = merged;
  write(BEST_KEY, bests);
  if (localAhead) await cloud.set({ [BEST_KEY]: JSON.stringify(bests) });
  return true;
}

export const bestOf = (scenarioId, pair) => bests[bestKey(scenarioId, pair)] ?? null;
export const allBests = () => bests;

/** Records a finished round; returns true when it is a new best for its scenario × pair. */
export function recordResult(scenarioId, pair, outcome) {
  const key = bestKey(scenarioId, pair);
  if (bests[key]?.returnPct >= outcome.returnPct) return false;
  bests = { ...bests, [key]: { returnPct: outcome.returnPct, equity: outcome.equity, trades: outcome.trades, at: Date.now() } };
  write(BEST_KEY, bests);
  cloud.set({ [BEST_KEY]: JSON.stringify(bests) });
  return true;
}

export const loadPrefs = () => read(PREFS_KEY) ?? {};
export const savePrefs = (prefs) => write(PREFS_KEY, prefs);

export const loadRound = () => read(ROUND_KEY);
export const saveRound = (round) => write(ROUND_KEY, round);
