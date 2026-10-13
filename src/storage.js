// What is remembered between visits: the best result per scenario × pair,
// the settings that should follow the player (the colour scheme), a few
// preferences of this device, and the round in progress. Bests and settings
// also go to the Toy cloud save when there is one; the rest stays in
// localStorage.
import { cloud } from "./toy.js";

const BEST_KEY = "hebi8fx_best_v1";
const SETTINGS_KEY = "hebi8fx_settings_v1";
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
let settings = read(SETTINGS_KEY) ?? {};

function parse(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Brings the cloud save and this device together. Bests: the higher return
 * wins and the cloud gets what it lacks. Settings: the cloud copy wins when
 * there is one, otherwise this device's choices are sent up.
 * Answers `{ bests, settings }`: whether either changed here.
 */
export async function syncCloud() {
  const remote = await cloud.get([BEST_KEY, SETTINGS_KEY]);
  if (!remote) return { bests: false, settings: false };

  const cloudSettings = parse(remote[SETTINGS_KEY]);
  let settingsChanged = false;
  if (cloudSettings) {
    settingsChanged = JSON.stringify(cloudSettings) !== JSON.stringify(settings);
    settings = cloudSettings;
    write(SETTINGS_KEY, settings);
  } else if (Object.keys(settings).length) {
    cloud.set({ [SETTINGS_KEY]: JSON.stringify(settings) });
  }

  const parsed = parse(remote[BEST_KEY]);
  let localAhead = false;
  const merged = { ...parsed };
  for (const [key, value] of Object.entries(bests)) {
    if (!(merged[key]?.returnPct >= value.returnPct)) {
      merged[key] = value;
      localAhead = true;
    }
  }
  const bestsChanged = JSON.stringify(merged) !== JSON.stringify(bests);
  bests = merged;
  write(BEST_KEY, bests);
  if (localAhead) cloud.set({ [BEST_KEY]: JSON.stringify(bests) });
  return { bests: bestsChanged, settings: settingsChanged };
}

export const loadSettings = () => settings;
/** Changes settings here and, when there is one, in the cloud save. */
export function saveSettings(patch) {
  settings = { ...settings, ...patch };
  write(SETTINGS_KEY, settings);
  cloud.set({ [SETTINGS_KEY]: JSON.stringify(settings) });
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
