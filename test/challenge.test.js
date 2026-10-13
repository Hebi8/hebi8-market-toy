import test from "node:test";
import assert from "node:assert/strict";
import { TOY_URL, challengeGap, challengePath, challengeUrl, parseChallenge } from "../src/engine/challenge.js";
import { SCORE_MAX, returnOf, scoreOf } from "../src/engine/score.js";

// Shaped like public/data/index.json: one scenario lacks a pair.
const index = {
  pairs: ["USDJPY", "EURJPY", "AUDJPY"],
  scenarios: [
    { id: "2022-09-22-intervention", title: "24 年来首次买入日元", pairs: { USDJPY: {}, EURJPY: {}, AUDJPY: {} } },
    { id: "2011-10-31-intervention", title: "日本单独干预", pairs: { EURJPY: {}, AUDJPY: {} } },
  ],
};

test("a score is final equity over the opening balance in hundredths of a percent", () => {
  assert.equal(scoreOf(0), 10_000);
  assert.equal(scoreOf(3.21), 10_321);
  assert.equal(scoreOf(-3.409), 9_659);
  assert.equal(scoreOf(-100), 0);
  // Never negative, never above what the leaderboard takes.
  assert.equal(scoreOf(-250), 0);
  assert.equal(scoreOf(1e9), SCORE_MAX);
  assert.ok(Math.abs(returnOf(10_321) - 3.21) < 1e-9);
  assert.equal(returnOf(0), -100);
});

test("a link carries the scenario, the pair and the score, and reads back as the same round", () => {
  const round = { scenarioId: "2022-09-22-intervention", pair: "USDJPY", returnPct: 3.2149 };
  const url = challengeUrl(round);
  assert.equal(url, `${TOY_URL}?s=2022-09-22-intervention&p=USDJPY&r=10321`);
  assert.equal(challengePath(round), "index.html?s=2022-09-22-intervention&p=USDJPY&r=10321");

  const challenge = parseChallenge(new URL(url).search, index);
  assert.equal(challenge.scenario, index.scenarios[0]);
  assert.equal(challenge.pair, "USDJPY");
  assert.equal(challenge.score, 10_321);
  assert.ok(Math.abs(challenge.returnPct - 3.21) < 1e-9);

  // A wiped-out round is still a round.
  assert.equal(parseChallenge("?s=2022-09-22-intervention&p=AUDJPY&r=0", index).returnPct, -100);
  assert.equal(parseChallenge(`?s=2022-09-22-intervention&p=AUDJPY&r=${SCORE_MAX}`, index).score, SCORE_MAX);
});

test("no challenge without all three values", () => {
  assert.equal(parseChallenge("", index), null);
  assert.equal(parseChallenge("?s=2022-09-22-intervention&p=USDJPY", index), null);
  assert.equal(parseChallenge("?s=2022-09-22-intervention&r=10321", index), null);
  assert.equal(parseChallenge("?p=USDJPY&r=10321", index), null);
  assert.equal(parseChallenge("?s=&p=&r=", index), null);
});

test("a scenario or pair the game does not have is no challenge", () => {
  assert.equal(parseChallenge("?s=1999-01-01-nothing&p=USDJPY&r=10321", index), null);
  assert.equal(parseChallenge("?s=2022-09-22-intervention&p=GBPJPY&r=10321", index), null);
  assert.equal(parseChallenge("?s=2022-09-22-intervention&p=usdjpy&r=10321", index), null);
  // The pair exists, but not for this scenario.
  assert.equal(parseChallenge("?s=2011-10-31-intervention&p=USDJPY&r=10321", index), null);
  // Names that are properties of every object are not scenarios or pairs either.
  assert.equal(parseChallenge("?s=2022-09-22-intervention&p=constructor&r=10321", index), null);
  assert.equal(parseChallenge("?s=__proto__&p=USDJPY&r=10321", index), null);
});

test("the score has to be a whole number in range, written plainly", () => {
  const link = (r) => parseChallenge(`?s=2022-09-22-intervention&p=USDJPY&r=${r}`, index);
  for (const bad of ["-1", "103.21", "1e4", "0x10", "010321", "+10321", " 10321", "10321abc", "abc", `${SCORE_MAX + 1}`, "99999999999999999999", "NaN", "%3Cb%3E"]) {
    assert.equal(link(bad), null, bad);
  }
  assert.equal(link("10321").score, 10_321);
});

test("anything else in the link is ignored, and nothing from it is passed on", () => {
  const challenge = parseChallenge("?from=share&s=2022-09-22-intervention&name=%3Cimg%20src%3Dx%3E&p=EURJPY&r=9500&spm_id_from=333.40216", index);
  assert.deepEqual(Object.keys(challenge).sort(), ["pair", "returnPct", "scenario", "score"]);
  assert.equal(challenge.pair, "EURJPY");
  assert.equal(challenge.score, 9_500);
  // The first value counts when one is given twice.
  assert.equal(parseChallenge("?s=2022-09-22-intervention&p=EURJPY&r=9500&r=99999", index).score, 9_500);
});

test("a round is compared with its challenge in the link's own units", () => {
  const challenge = parseChallenge("?s=2022-09-22-intervention&p=USDJPY&r=10321", index);
  assert.equal(challengeGap(5.5, challenge), 2.29);
  assert.equal(challengeGap(-3.41, challenge), -6.62);
  // 3.2149% and 3.21% are the same score: a tie, not a win by a hair.
  assert.equal(challengeGap(3.2149, challenge), 0);
});
