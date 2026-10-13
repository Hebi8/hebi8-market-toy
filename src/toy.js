// The Bilibili Toy bridge. The SDK is only loaded on Toy's own hosts; in a
// plain browser (local preview) every function here answers "not available"
// and the game falls back to localStorage and a local best score.
//
// The SDK has no public reference, so every call is probed with `isSupport`
// first and wrapped: a failure never reaches the game.

import { scoreOf } from "./engine/score.js";

const SDK_URL = "https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js";
const toyHost = /(^|\.)(bilibili\.com|bilibilitoy\.com)$/.test(location.hostname);
/** The author's Bilibili space, where the "作者主页" button leads. */
const AUTHOR = { id: "66384529", url: "https://space.bilibili.com/66384529" };
/** The single leaderboard; what a score means is in ./engine/score.js. */
const BOARD = 1;

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

let profile = null;
/**
 * The player's `{ nickname, avatar }`, or null. The first call makes the
 * platform ask the player for consent, so it is only made once they chose to
 * share; the answer, a refusal included, is kept for the rest of the visit.
 */
export function userProfile() {
  profile ??= (async () => {
    try {
      const toy = await toyWith("getUserProfile");
      if (!toy) return null;
      const answer = await toy.getUserProfile();
      const nickname = typeof answer?.nickname === "string" ? answer.nickname.trim() : "";
      if (!nickname) return null;
      const avatar = typeof answer.avatar === "string" && answer.avatar.startsWith("https://") ? answer.avatar : null;
      return { nickname, avatar };
    } catch {
      return null;
    }
  })();
  return profile;
}

/** Puts a PNG (as a data URL) into the phone's album; only the Bilibili app can. True when it did. */
export async function saveToAlbum(dataUrl) {
  try {
    const toy = await toyWith("saveImageToAlbum");
    if (!toy) return false;
    await toy.saveImageToAlbum({ base64Data: dataUrl.slice(dataUrl.indexOf(",") + 1), hintMsg: "战绩图已保存到相册" });
    return true;
  } catch {
    return false;
  }
}

/** Whether the container has a share sheet of its own (the Bilibili app does). */
export const canShare = () => toyWith("share").then(Boolean, () => false);
/** Opens it for `path`, a page inside this Toy with its query string. True when it opened. */
export async function shareToy(path) {
  try {
    const toy = await toyWith("share");
    if (!toy) return false;
    await toy.share({ path });
    return true;
  } catch {
    return false;
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
