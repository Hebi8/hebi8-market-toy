// A round's result as one whole number: final equity against the opening
// balance, in hundredths of a percent (10000 = break-even, 10321 = +3.21%).
// The leaderboard stores it and a challenge link carries it. Kept at zero or
// above: a losing round sent as a negative score never appeared on the board.

/** The Toy leaderboard accepts integer scores up to 2^24 − 1. */
export const SCORE_MAX = 2 ** 24 - 1;

export const scoreOf = (returnPct) => Math.max(0, Math.min(SCORE_MAX, Math.round((100 + returnPct) * 100)));
export const returnOf = (score) => score / 100 - 100;
