import test from "node:test";
import assert from "node:assert/strict";
import {
  closeAll, closePosition, createAccount, finish, lotsForLeverage, mark, maxLots, modifyPosition,
  openPosition, orderLeverage, positionLeverage, quote, result, step, summary, unleveragedBuyAndHold,
} from "../src/engine/engine.js";

// USDJPY: spread 0.003 yen, 1 lot = 10,000 units, leverage 25, balance 1,000,000.
const account = (bid = 150) => {
  const state = createAccount("USDJPY");
  mark(state, bid, 0);
  return state;
};
const bar = (o, h, l, c, t = 60) => ({ t, o, h, l, c });

test("a buy fills at the ask and its profit is the yen move times the units", () => {
  const state = account();
  assert.deepEqual(quote(state), { bid: 150, ask: 150.003 });
  const { ok, position } = openPosition(state, { side: "buy", lots: 1 });
  assert.equal(ok, true);
  assert.equal(position.open, 150.003);
  assert.equal(position.units, 10_000);
  assert.equal(position.margin, 60_002); // 150.003 × 10,000 / 25, rounded up
  // Opening costs the spread at once.
  assert.equal(summary(state).floating, -30);

  mark(state, 151, 60);
  assert.deepEqual(summary(state), {
    balance: 1_000_000,
    equity: 1_009_970,
    margin: 60_002,
    freeMargin: 949_968,
    marginLevel: 1_009_970 / 60_002,
    floating: 9_970,
    notional: 1_510_000,
    leverage: 1_510_000 / 1_009_970,
  });
  const trade = closePosition(state, position.id);
  assert.equal(trade.close, 151);
  assert.equal(trade.profit, 9_970);
  assert.equal(state.balance, 1_009_970);
  assert.equal(summary(state).marginLevel, null);
});

test("a sell fills at the bid, closes at the ask and gains when the price falls", () => {
  const state = account();
  const { position } = openPosition(state, { side: "sell", lots: 2 });
  assert.equal(position.open, 150);
  mark(state, 149, 60);
  assert.equal(summary(state).floating, 19_940); // (150 − 149.003) × 20,000
  mark(state, 151, 120);
  assert.equal(summary(state).floating, -20_060);
  const trade = closePosition(state, position.id);
  assert.equal(trade.close, 151.003);
  assert.equal(state.balance, 979_940);
});

test("orders are refused without margin, below the minimum size or with levels on the wrong side", () => {
  const state = account();
  assert.equal(openPosition(state, { side: "buy", lots: 17 }).reason, "margin");
  assert.equal(openPosition(state, { side: "buy", lots: 0.04 }).reason, "lots");
  assert.equal(openPosition(state, { side: "buy", lots: 1, sl: 150 }).reason, "sl");
  assert.equal(openPosition(state, { side: "buy", lots: 1, tp: 150 }).reason, "tp");
  assert.equal(openPosition(state, { side: "sell", lots: 1, sl: 150.003 }).reason, "sl");
  assert.equal(openPosition(state, { side: "sell", lots: 1, tp: 150.003 }).reason, "tp");
  assert.equal(state.positions.length, 0);

  const lots = maxLots(state);
  assert.equal(lots, 16.6);
  assert.equal(openPosition(state, { side: "buy", lots }).ok, true);
  assert.equal(maxLots(state), 0);
});

test("several positions can be held at once and closed together", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1 });
  openPosition(state, { side: "sell", lots: 0.5 });
  openPosition(state, { side: "buy", lots: 0.3 });
  assert.equal(state.positions.length, 3);
  assert.equal(summary(state).margin, 60_002 + 30_000 + 18_001);
  mark(state, 150.5, 60);
  const trades = closeAll(state);
  assert.deepEqual(trades.map((trade) => trade.profit), [4_970, -2_515, 1_491]);
  assert.equal(state.balance, 1_003_946);
  assert.equal(state.positions.length, 0);
});

test("a stop-loss fills at its level when a bar's low reaches it", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1, sl: 149.5 });
  assert.deepEqual(step(state, bar(150, 150.2, 149.51, 150.1)), []);
  const [event] = step(state, bar(150.1, 150.2, 149.4, 150.1, 120));
  assert.equal(event.type, "sl");
  assert.equal(event.trade.close, 149.5);
  assert.equal(event.trade.profit, -5_030);
  assert.equal(state.status, "open");
});

test("a bar that opens beyond the stop-loss fills at the open, not at the level", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1, sl: 149.5 });
  const [event] = step(state, bar(149.2, 149.3, 149.1, 149.25));
  assert.equal(event.trade.close, 149.2);
  assert.equal(event.trade.profit, -8_030);
});

test("stop-loss and take-profit inside the same bar: the stop-loss wins", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1, sl: 149.5, tp: 150.5 });
  const events = step(state, bar(150, 150.6, 149.4, 150.55));
  assert.deepEqual(events.map((event) => event.type), ["sl"]);
  assert.equal(state.balance, 1_000_000 - 5_030);

  // The same for a short, whose levels are judged on the ask.
  const short = account();
  openPosition(short, { side: "sell", lots: 1, sl: 150.5, tp: 149.5 });
  const shortEvents = step(short, bar(150, 150.6, 149.4, 149.45));
  assert.deepEqual(shortEvents.map((event) => event.type), ["sl"]);
  assert.equal(short.balance, 1_000_000 - 5_000);
});

test("a take-profit alone fills at its level, never better", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1, tp: 150.5 });
  const [event] = step(state, bar(150.7, 150.9, 150.6, 150.8));
  assert.equal(event.type, "tp");
  assert.equal(event.trade.close, 150.5);
  assert.equal(event.trade.profit, 4_970);
});

test("a short's levels are touched by the ask: the bid plus the spread", () => {
  const stopped = account();
  openPosition(stopped, { side: "sell", lots: 1, sl: 150.5 });
  assert.deepEqual(step(stopped, bar(150, 150.496, 149.9, 150.1)), []);
  const [sl] = step(stopped, bar(150.1, 150.497, 150, 150.2, 120));
  assert.equal(sl.type, "sl");
  assert.equal(sl.trade.close, 150.5);
  assert.equal(sl.trade.profit, -5_000);

  const taken = account();
  openPosition(taken, { side: "sell", lots: 1, tp: 149.5 });
  assert.deepEqual(step(taken, bar(150, 150.1, 149.498, 149.6)), []);
  const [tp] = step(taken, bar(149.6, 149.7, 149.497, 149.6, 120));
  assert.equal(tp.type, "tp");
  assert.equal(tp.trade.profit, 5_000);
});

test("forced liquidation closes at the price where the margin level falls below 100%", () => {
  const state = account();
  const { position } = openPosition(state, { side: "buy", lots: 16 });
  assert.equal(position.margin, 960_020);
  // Equity 961,120 at 149.760 is still above the 960,020 of margin in use.
  assert.deepEqual(step(state, bar(150, 150.1, 149.76, 149.9)), []);
  assert.equal(state.status, "open");

  const [event] = step(state, bar(149.9, 150, 149.5, 149.6, 120));
  assert.equal(event.type, "stopout");
  // 150.003 − 39,980 / 160,000 = 149.753125, rounded against the account.
  assert.equal(event.trade.close, 149.753);
  assert.equal(event.trade.profit, -40_000);
  assert.equal(state.balance, 960_000);
  assert.equal(state.positions.length, 0);
  assert.equal(state.status, "liquidated");
  // Nothing more happens to a liquidated account.
  assert.deepEqual(step(state, bar(149.6, 149.7, 140, 141, 180)), []);
  assert.equal(openPosition(state, { side: "buy", lots: 1 }).reason, "closed");
});

test("a bar that opens below the liquidation price liquidates at the open", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 16 });
  const [event] = step(state, bar(149, 149.2, 148.9, 149.1));
  assert.equal(event.type, "stopout");
  assert.equal(event.trade.close, 149);
  assert.equal(event.trade.profit, -160_480);
});

test("a short is liquidated on the way up", () => {
  const state = account();
  const { position } = openPosition(state, { side: "sell", lots: 16 });
  assert.equal(position.margin, 960_000);
  const [event] = step(state, bar(150, 150.5, 149.9, 150.4));
  assert.equal(event.type, "stopout");
  assert.equal(event.trade.close, 150.25); // bid 150.247 plus the spread
  assert.equal(event.trade.profit, -40_000);
  assert.equal(state.status, "liquidated");
});

test("along the adverse path the level reached first acts first", () => {
  // A stop-loss above the liquidation price gets the position out first.
  const saved = account();
  openPosition(saved, { side: "buy", lots: 16, sl: 149.8 });
  const [sl] = step(saved, bar(150, 150.1, 149.5, 149.6));
  assert.equal(sl.type, "sl");
  assert.equal(sl.trade.close, 149.8);
  assert.equal(saved.status, "open");

  // One below it is never reached.
  const late = account();
  openPosition(late, { side: "buy", lots: 16, sl: 149.7 });
  const [stopout] = step(late, bar(150, 150.1, 149.5, 149.6));
  assert.equal(stopout.type, "stopout");
  assert.equal(stopout.trade.close, 149.753);
});

test("forced liquidation is judged before a take-profit in the same bar", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 16, tp: 150.1 });
  const events = step(state, bar(150, 150.2, 149.5, 150.15));
  assert.deepEqual(events.map((event) => event.type), ["stopout"]);
  assert.equal(state.status, "liquidated");
});

test("liquidation takes the largest loss first and stops once the margin level is restored", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 10 });
  step(state, bar(150, 150, 149, 149));
  assert.equal(summary(state).equity, 899_700);
  const second = openPosition(state, { side: "buy", lots: 4 });
  assert.equal(second.ok, true);
  assert.equal(summary(state).margin, 600_012 + 238_405);

  const events = step(state, bar(149, 149, 148, 148.2, 120));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "stopout");
  assert.equal(events[0].trade.lots, 10);
  assert.equal(events[0].trade.close, 148.563);
  assert.equal(events[0].trade.profit, -144_000);
  // The smaller position survives, so the round goes on.
  assert.equal(state.positions.length, 1);
  assert.equal(state.status, "open");
  assert.equal(summary(state).equity, 856_000 - 32_120);
});

test("a hedged account walks to the extreme that hurts its net position first", () => {
  // Net short 4 lots: the high comes first, so the long's take-profit (also
  // touched in this bar) is not what frees the margin.
  const state = account();
  openPosition(state, { side: "sell", lots: 10, sl: 150.4 });
  openPosition(state, { side: "buy", lots: 6, sl: 149.6, tp: 150.3 });
  const events = step(state, bar(150, 150.5, 149.5, 150));
  assert.deepEqual(events.map((event) => [event.type, event.trade.side]), [["sl", "sell"], ["sl", "buy"]]);
  assert.equal(state.balance, 1_000_000 - 40_000 - 24_180);
});

test("maximum drawdown follows equity inside the bar, not just at the close", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1 });
  step(state, bar(150, 150, 149, 150));
  assert.equal(state.minEquity, 989_970);
  assert.ok(Math.abs(state.maxDrawdown - 10_030 / 1_000_000) < 1e-12);
  step(state, bar(150, 152, 150, 152, 120));
  assert.equal(state.peakEquity, 1_019_970);
  step(state, bar(152, 152, 151, 151.5, 180));
  assert.ok(Math.abs(state.maxDrawdown - 10_030 / 1_000_000) < 1e-12);
  step(state, bar(151.5, 151.5, 150, 150, 240));
  assert.ok(Math.abs(state.maxDrawdown - 20_000 / 1_019_970) < 1e-12);
});

test("the end of the replay closes what is open and reports the round", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 2 });
  openPosition(state, { side: "sell", lots: 1 });
  step(state, bar(150, 151, 150, 151));
  const trades = finish(state);
  assert.deepEqual(trades.map((trade) => [trade.reason, trade.profit]), [["end", 19_940], ["end", -10_030]]);
  assert.equal(state.status, "finished");
  const summaryLine = result(state);
  assert.equal(summaryLine.equity, 1_009_910);
  assert.ok(Math.abs(summaryLine.returnPct - 0.991) < 1e-9);
  assert.equal(summaryLine.trades, 2);
  assert.equal(summaryLine.wins, 1);
  assert.deepEqual(finish(state), []);
});

test("stop-loss and take-profit can be changed on an open position", () => {
  const state = account();
  const { position } = openPosition(state, { side: "buy", lots: 1 });
  assert.equal(modifyPosition(state, position.id, { sl: 150.2 }).reason, "sl");
  assert.equal(modifyPosition(state, position.id, { sl: 149.9, tp: 150.2 }).ok, true);
  const [event] = step(state, bar(150, 150.25, 149.95, 150.2));
  assert.equal(event.type, "tp");
});

test("effective leverage is what is open, in yen, over the equity", () => {
  const state = account();
  assert.equal(summary(state).leverage, 0);
  // An order of one lot is worth 1,500,030 yen: one and a half times the account.
  assert.ok(Math.abs(orderLeverage(state, 1) - 1.50003) < 1e-12);

  const { position: long } = openPosition(state, { side: "buy", lots: 3 });
  assert.equal(summary(state).notional, 4_500_000);
  assert.ok(Math.abs(summary(state).leverage - 4_500_000 / 999_910) < 1e-12);
  assert.ok(Math.abs(positionLeverage(state, long) - 4_500_000 / 999_910) < 1e-12);

  // A short adds to the exposure instead of cancelling it.
  const { position: short } = openPosition(state, { side: "sell", lots: 1 });
  assert.equal(summary(state).notional, 6_000_000);
  assert.ok(Math.abs(positionLeverage(state, short) - 1_500_000 / 999_880) < 1e-12);

  // Losses shrink the equity, so the same positions weigh more.
  mark(state, 148, 60);
  assert.equal(summary(state).equity, 1_000_000 - 60_090 + 19_970);
  assert.ok(Math.abs(summary(state).leverage - 5_920_000 / 959_880) < 1e-12);
  assert.ok(Math.abs(orderLeverage(state, 1) - 1_480_030 / 959_880) < 1e-12);
});

test("an order can be sized as a multiple of the equity", () => {
  const state = account();
  // 1,000,000 / (150.003 × 10,000) = 0.666… lots per 1×, rounded down to 0.1 lot.
  assert.equal(lotsForLeverage(state, 1), 0.6);
  assert.equal(lotsForLeverage(state, 5), 3.3);
  assert.equal(lotsForLeverage(state, 10), 6.6);
  // Beyond what the margin allows it stops at the largest possible order.
  assert.equal(lotsForLeverage(state, 40), maxLots(state));
  assert.ok(orderLeverage(state, lotsForLeverage(state, 5)) <= 5);

  // With part of the margin in use, less is left to open.
  openPosition(state, { side: "buy", lots: 10 });
  assert.equal(lotsForLeverage(state, 10), maxLots(state));
  assert.equal(lotsForLeverage(state, 1), 0.6);

  // An account too small for a tenth of a lot per 1× still gets the smallest order.
  const small = account();
  small.balance = 100_000;
  assert.equal(lotsForLeverage(small, 1), 0.1);
});

test("without equity there is no leverage to speak of", () => {
  const state = account();
  openPosition(state, { side: "buy", lots: 1 });
  state.balance = -5_000;
  assert.equal(summary(state).leverage, null);
  assert.equal(orderLeverage(state, 1), null);
});

test("the benchmark is buying once at leverage 1 and holding to the end", () => {
  const bars = [bar(150, 150.1, 149.9, 150, 60), bar(150, 150.2, 148, 148.5, 120), bar(148.5, 153, 148.5, 153, 180)];
  const plain = unleveragedBuyAndHold("USDJPY", 150, bars);
  assert.ok(Math.abs(plain.returnPct - ((153 - 150.003) / 150.003) * 100) < 1e-12);
  assert.equal(plain.equity, 1_019_980);
  assert.equal(unleveragedBuyAndHold("USDJPY", 150, []).equity, 999_980);
});
