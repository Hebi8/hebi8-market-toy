// "Beat my round" links: the address of the Toy plus which round it was and
// how it ended. Pure functions; the page decides what to do with the answer.
//
// A link carries three values and nothing else: the scenario id, the pair and
// the score. No name, no free text. Whatever is in a link ends up on the
// page, and anyone can edit a link, so it must not be able to say anything
// the game would not say itself. Each value is checked against what the game
// knows before it is used.
import { SCORE_MAX, returnOf, scoreOf } from "./score.js";

/** Where the published Toy lives. The outer page hands the query string on to the game. */
export const TOY_URL = "https://www.bilibili.com/toy/hebi8-fx-replay/index.html";
/** The same page from inside the Toy, for the container's own share sheet. */
const TOY_PAGE = "index.html";

const query = ({ scenarioId, pair, returnPct }) =>
  new URLSearchParams({ s: scenarioId, p: pair, r: String(scoreOf(returnPct)) }).toString();

/** The link that challenges someone to the round `{ scenarioId, pair, returnPct }`. */
export const challengeUrl = (round) => `${TOY_URL}?${query(round)}`;
/** The same as a path inside the Toy. */
export const challengePath = (round) => `${TOY_PAGE}?${query(round)}`;

/**
 * Reads a challenge out of a query string (`location.search`). `index` is the
 * scenario index the game loaded. Answers `{ scenario, pair, score, returnPct }`
 * or null when anything is missing or not something the game has; parameters
 * it does not know are ignored.
 */
export function parseChallenge(search, index) {
  const params = new URLSearchParams(search);
  const scenario = index.scenarios.find((item) => item.id === params.get("s"));
  const pair = params.get("p");
  const raw = params.get("r");
  if (!scenario || !index.pairs.includes(pair) || !scenario.pairs[pair]) return null;
  // Digits only, written the one way scoreOf writes them: no sign, no decimals, no padding.
  if (raw == null || !/^(0|[1-9]\d{0,7})$/.test(raw)) return null;
  const score = Number(raw);
  if (score > SCORE_MAX) return null;
  return { scenario, pair, score, returnPct: returnOf(score) };
}

/**
 * How a finished round stands against the challenge it took up: the gap in
 * percentage points (positive = ahead), judged on the same whole numbers the
 * link carries so that a tie is a tie.
 */
export function challengeGap(returnPct, challenge) {
  return (scoreOf(returnPct) - challenge.score) / 100;
}
