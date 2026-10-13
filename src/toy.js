// The Bilibili Toy bridge. The SDK is only loaded on Toy's own hosts; in a
// plain browser (local preview) every function here answers "not available"
// and the game falls back to localStorage and a local best score.
//
// The SDK has no public reference, so every call is probed with `isSupport`
// first and wrapped: a failure never reaches the game.

const SDK_URL = "https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js";
const toyHost = /(^|\.)(bilibili\.com|bilibilitoy\.com)$/.test(location.hostname);
/** The author's Bilibili space, where the "作者主页" button leads. */
const AUTHOR = { id: "66384529", url: "https://space.bilibili.com/66384529" };
/**
 * The single leaderboard: a round's final equity against the opening balance,
 * in hundredths of a percent (10000 = break-even). Kept at zero or above: a
 * losing round sent as a negative score never appeared on the board.
 */
const BOARD = 1;
// The SDK accepts integer scores in ±2^24.
const SCORE_MAX = 2 ** 24 - 1;

let loading = null;
function sdk() {
  if (!toyHost) return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.onload = () => resolve(window.toy ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  return loading;
}

const supported = new Map();
/** The SDK object when it offers `ability`, else null. */
async function toyWith(ability) {
  const toy = await sdk();
  if (!toy) return null;
  if (!supported.has(ability)) {
    supported.set(ability, Promise.resolve().then(() => toy.isSupport(ability)).then(Boolean, () => false));
  }
  return (await supported.get(ability)) ? toy : null;
}

/** Keeps `--toy-safe-*` in step with the container's safe area. */
export async function watchSafeArea() {
  try {
    const toy = await toyWith("onContainerChange");
    if (!toy) return;
    const off = toy.onContainerChange(({ safeArea }) => {
      for (const side of ["top", "right", "bottom", "left"]) {
        document.documentElement.style.setProperty(`--toy-safe-${side}`, `${Math.max(0, Number(safeArea?.[side]) || 0)}px`);
      }
    });
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) off?.();
    }, { once: true });
  } catch {
    // Older clients keep the CSS env() fallback.
  }
}

/**
 * Opens the author's space: through the container inside Bilibili, in a new
 * tab anywhere else. Call it from a click; the SDK insists on a user gesture.
 */
export async function openAuthorSpace() {
  try {
    const toy = await toyWith("navigate");
    if (toy) {
      await toy.navigate({ type: "space", id: AUTHOR.id });
      return;
    }
  } catch {
    // Fall through to a plain new tab.
  }
  window.open(AUTHOR.url, "_blank", "noopener");
}
/** Loads the SDK and asks about `navigate` ahead of the click, so the click itself has nothing to wait for. */
export const prepareNavigate = () => toyWith("navigate").then(Boolean, () => false);

/** Whether a leaderboard exists here at all (decides what the result page shows). */
export async function hasRank() {
  return Boolean(await toyWith("submitScore")) && Boolean(await toyWith("getRankList"));
}

export const scoreOf = (returnPct) => Math.max(0, Math.min(SCORE_MAX, Math.round((100 + returnPct) * 100)));
export const returnOf = (score) => score / 100 - 100;

/** Sends a round's result: true when the board took it, otherwise why not, in the SDK's own words. */
export async function submitScore(returnPct) {
  try {
    const toy = await toyWith("submitScore");
    if (!toy) return "这里没有排行榜接口";
    await toy.submitScore({ board: BOARD, score: scoreOf(returnPct) });
    return true;
  } catch (error) {
    return [error?.type, error?.message].filter(Boolean).join(": ").slice(0, 120) || "未知原因";
  }
}

const firstArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const key of ["list", "items", "ranks", "rankList", "data"]) {
    const found = firstArray(value[key]);
    if (found) return found;
  }
  return null;
};
const pick = (object, keys) => {
  for (const key of keys) if (object?.[key] != null && object[key] !== "") return object[key];
  return null;
};
// The shape of a row is not documented either: read the usual names.
const rankRow = (row, index) => {
  const score = Number(pick(row, ["score", "value"]));
  if (!Number.isFinite(score)) return null;
  const user = row.user ?? row.profile ?? row;
  return {
    rank: Number(pick(row, ["rank", "ranking", "index"])) || index + 1,
    name: String(pick(user, ["nickname", "uname", "name"]) ?? "玩家"),
    score,
    self: Boolean(pick(row, ["isSelf", "is_self", "self"])),
  };
};

/** Top of the leaderboard as `{ rank, name, score, self }`, or null when unavailable. */
export async function rankList(limit = 20) {
  try {
    const toy = await toyWith("getRankList");
    if (!toy) return null;
    const rows = firstArray(await toy.getRankList({ board: BOARD, period: "all", limit }));
    return rows ? rows.map(rankRow).filter(Boolean) : null;
  } catch {
    return null;
  }
}

/** The player's own `{ rank, score }`, or null. */
export async function myRank() {
  try {
    const toy = await toyWith("getMyRank");
    if (!toy) return null;
    const answer = await toy.getMyRank({ board: BOARD, period: "all" });
    const row = answer?.data ?? answer?.my ?? answer;
    const score = Number(pick(row, ["score", "value"]));
    const rank = Number(pick(row, ["rank", "ranking"]));
    return Number.isFinite(score) && rank > 0 ? { rank, score } : null;
  } catch {
    return null;
  }
}

/** Cloud save: `get` answers `{ key: string }` or null, `set` whether it was stored. */
export const cloud = {
  async get(keys) {
    try {
      const toy = await toyWith("getCloudStorage");
      return toy ? await toy.getCloudStorage(keys) : null;
    } catch {
      return null;
    }
  },
  async set(items) {
    try {
      const toy = await toyWith("setCloudStorage");
      if (!toy) return false;
      await toy.setCloudStorage(items);
      return true;
    } catch {
      return false;
    }
  },
};
