// The trading account of one round: orders, margin, forced liquidation and
// what happens to open positions inside a bar. Pure functions over a plain
// (JSON-serialisable) state object; no DOM, no clock, no randomness.
//
// Prices are bid prices in yen. A buy opens at bid + spread and closes at bid;
// a sell opens at bid and closes at bid + spread. All pairs are quoted in yen,
// so profit is simply price difference × units.
import { RULES } from "./rules.js";

const BUY = "buy";
const SELL = "sell";

const roundPrice = (value, decimals) => Number(value.toFixed(decimals));
const roundLots = (lots, rules) => Math.round(lots / rules.lotStep) * rules.lotStep;

export function createAccount(pair, rules = RULES) {
  const spread = rules.spread[pair];
  if (!(spread >= 0)) throw new Error(`no spread configured for ${pair}`);
  return {
    pair,
    spread,
    decimals: rules.priceDecimals,
    balance: rules.initialBalance,
    /** Last known bid; orders fill against it. */
    price: null,
    time: null,
    positions: [],
    closed: [],
    nextId: 1,
    /** open | liquidated | finished */
    status: "open",
    peakEquity: rules.initialBalance,
    minEquity: rules.initialBalance,
    /** Largest fall from a peak of equity, as a fraction of that peak. */
    maxDrawdown: 0,
  };
}

/** Sets the price a round starts from (the close of the last bar already shown). */
export function mark(state, bid, time = state.time) {
  state.price = bid;
  state.time = time;
}

export const quote = (state) => ({ bid: state.price, ask: roundPrice(state.price + state.spread, state.decimals) });

/** Price a position would close at when the bid is `bid`. */
const exitPrice = (state, position, bid) => (position.side === BUY ? bid : bid + state.spread);

export function profitAt(state, position, bid) {
  const exit = exitPrice(state, position, bid);
  const move = position.side === BUY ? exit - position.open : position.open - exit;
  return Math.round(move * position.units);
}

const usedMargin = (state) => state.positions.reduce((sum, position) => sum + position.margin, 0);
const floatingAt = (state, bid) => state.positions.reduce((sum, position) => sum + profitAt(state, position, bid), 0);
const equityAt = (state, bid) => state.balance + floatingAt(state, bid);

/** The MT5-style account line at bid `bid` (default: the current price). */
export function summary(state, bid = state.price) {
  const margin = usedMargin(state);
  const floating = bid == null ? 0 : floatingAt(state, bid);
  const equity = state.balance + floating;
  return {
    balance: state.balance,
    equity,
    margin,
    freeMargin: equity - margin,
    /** Equity / used margin; null while nothing is open. */
    marginLevel: margin > 0 ? equity / margin : null,
    floating,
  };
}

const marginFor = (price, units, rules) => Math.ceil((price * units) / rules.leverage);

/** Largest order the free margin allows right now, on the lot grid. */
export function maxLots(state, rules = RULES) {
  if (state.price == null || state.status !== "open") return 0;
  const { freeMargin } = summary(state);
  const perLot = marginFor(state.price + state.spread, rules.lotUnits, rules);
  let steps = Math.floor(freeMargin / perLot / rules.lotStep + 1e-9);
  // Margin is rounded up per order, so the last step may not fit after all.
  while (steps > 0 && marginFor(state.price + state.spread, Math.round(steps * rules.lotStep * rules.lotUnits), rules) > freeMargin) steps--;
  return Math.max(0, Number((steps * rules.lotStep).toFixed(4)));
}

/** Null when the levels are on the right side of the price, else which one is wrong. */
function levelError(state, side, sl, tp) {
  const reference = side === BUY ? state.price : state.price + state.spread;
  if (side === BUY) {
    if (sl != null && !(sl < reference)) return "sl";
    if (tp != null && !(tp > reference)) return "tp";
  } else {
    if (sl != null && !(sl > reference)) return "sl";
    if (tp != null && !(tp < reference)) return "tp";
  }
  return null;
}

/**
 * Market order at the current price. Returns `{ ok: true, position }` or
 * `{ ok: false, reason }` with reason `closed | lots | sl | tp | margin`.
 */
export function openPosition(state, { side, lots, sl = null, tp = null }, rules = RULES) {
  if (state.status !== "open" || state.price == null) return { ok: false, reason: "closed" };
  if (side !== BUY && side !== SELL) return { ok: false, reason: "side" };
  const size = Number(roundLots(Number(lots), rules).toFixed(4));
  if (!(size >= rules.minLots)) return { ok: false, reason: "lots" };
  const wrong = levelError(state, side, sl, tp);
  if (wrong) return { ok: false, reason: wrong };
  const open = roundPrice(side === BUY ? state.price + state.spread : state.price, state.decimals);
  const units = Math.round(size * rules.lotUnits);
  const margin = marginFor(open, units, rules);
  if (margin > summary(state).freeMargin) return { ok: false, reason: "margin" };
  const position = { id: state.nextId++, side, lots: size, units, open, openTime: state.time, margin, sl, tp };
  state.positions.push(position);
  return { ok: true, position };
}

/** Changes the stop-loss / take-profit of an open position (`null` removes one). */
export function modifyPosition(state, id, { sl = null, tp = null }) {
  const position = state.positions.find((item) => item.id === id);
  if (!position || state.status !== "open") return { ok: false, reason: "closed" };
  const wrong = levelError(state, position.side, sl, tp);
  if (wrong) return { ok: false, reason: wrong };
  position.sl = sl;
  position.tp = tp;
  return { ok: true, position };
}

/** Realises one position at close price `exit` (already on its own side of the spread). */
function settle(state, position, exit, reason, time) {
  const price = roundPrice(exit, state.decimals);
  const move = position.side === BUY ? price - position.open : position.open - price;
  const profit = Math.round(move * position.units);
  state.balance += profit;
  state.positions = state.positions.filter((item) => item !== position);
  const trade = { ...position, close: price, closeTime: time, profit, reason };
  state.closed.push(trade);
  return trade;
}

/** Closes at the current price. Reason `manual` unless given. */
export function closePosition(state, id, reason = "manual") {
  const position = state.positions.find((item) => item.id === id);
  if (!position || state.price == null) return null;
  return settle(state, position, exitPrice(state, position, state.price), reason, state.time);
}

export function closeAll(state, reason = "manual") {
  return [...state.positions].map((position) => closePosition(state, position.id, reason));
}

function observe(state, equity) {
  if (equity > state.peakEquity) state.peakEquity = equity;
  if (equity < state.minEquity) state.minEquity = equity;
  if (state.peakEquity > 0) {
    state.maxDrawdown = Math.max(state.maxDrawdown, (state.peakEquity - equity) / state.peakEquity);
  }
}

/** Bid at which a position's stop-loss is touched. */
const stopBid = (state, position) => (position.side === BUY ? position.sl : position.sl - state.spread);

/**
 * The bid moves in a straight line from `from` to `to`. Stop-losses and the
 * stop-out threshold are taken in the order the price reaches them. A level
 * the price is already beyond at `from` (a gap) fills at `from`.
 */
function sweep(state, from, to, time, rules, events) {
  const down = to < from;
  let at = from;
  for (;;) {
    if (!state.positions.length) return;
    // How far along the leg an event sits: 0 at `at`, growing towards `to`.
    const reach = (bid) => (down ? at - bid : bid - at);
    const length = reach(to);
    let next = null;

    for (const position of state.positions) {
      if (position.sl == null) continue;
      const level = stopBid(state, position);
      const beyond = position.side === BUY ? at <= level : at >= level;
      // Only a move against the position can reach a stop it is not yet beyond.
      if (!beyond && ((position.side === BUY) !== down || reach(level) > length)) continue;
      const distance = beyond ? 0 : reach(level);
      if (!next || distance < next.distance) next = { type: "sl", position, distance, bid: beyond ? at : level };
    }

    const need = rules.stopOutLevel * usedMargin(state);
    if (need > 0) {
      const here = equityAt(state, at);
      let distance = null;
      if (here < need) distance = 0;
      else if (length > 0 && equityAt(state, to) < need) {
        // Equity is linear in the bid, so the crossing can be solved for.
        const net = state.positions.reduce((sum, p) => sum + (p.side === BUY ? p.units : -p.units), 0);
        const crossing = at + (need - here) / net;
        distance = Math.min(length, Math.max(0, reach(crossing)));
      }
      // On a tie the stop-loss goes first: it is the order the player placed.
      if (distance != null && (!next || distance < next.distance)) next = { type: "stopout", distance };
    }

    if (!next) return;
    if (next.type === "sl") {
      events.push({ type: "sl", trade: settle(state, next.position, exitPrice(state, next.position, next.bid), "sl", time) });
      at = next.bid;
      continue;
    }
    // Forced liquidation: the position losing the most goes first.
    let bid = down ? at - next.distance : at + next.distance;
    // Never fill better than the threshold: round the bid against the account.
    const net = state.positions.reduce((sum, p) => sum + (p.side === BUY ? p.units : -p.units), 0);
    const scale = 10 ** state.decimals;
    bid = (net >= 0 ? Math.floor(bid * scale + 1e-6) : Math.ceil(bid * scale - 1e-6)) / scale;
    bid = down ? Math.max(bid, to) : Math.min(bid, to);
    if (next.distance === 0) bid = at;
    const worst = state.positions.reduce((a, b) => (profitAt(state, b, bid) < profitAt(state, a, bid) ? b : a));
    events.push({ type: "stopout", trade: settle(state, worst, exitPrice(state, worst, bid), "stopout", time) });
    observe(state, equityAt(state, bid));
    at = bid;
  }
}

/**
 * Applies one new bar `{ t, o, h, l, c }` to the open positions and returns
 * what it triggered, in order: `{ type: 'sl' | 'tp' | 'stopout', trade }`.
 *
 * A bar only says where the price started, how far it went each way and where
 * it ended. The order inside is assumed to be the one that is worst for the
 * account: open → the extreme that hurts the net position → the other extreme
 * → close. Stop-losses and forced liquidation are taken along that path;
 * take-profits are only looked at afterwards, for positions that survived it.
 * So a position whose stop-loss and take-profit both lie inside one bar is
 * always closed at the stop-loss.
 */
export function step(state, bar, rules = RULES) {
  const events = [];
  if (state.status !== "open") return events;
  state.time = bar.t;
  if (state.positions.length) {
    const net = state.positions.reduce((sum, p) => sum + (p.side === BUY ? p.units : -p.units), 0);
    const [first, second] = net >= 0 ? [bar.l, bar.h] : [bar.h, bar.l];
    sweep(state, bar.o, first, bar.t, rules, events);
    observe(state, equityAt(state, first));
    sweep(state, first, second, bar.t, rules, events);
    observe(state, equityAt(state, second));

    for (const position of [...state.positions]) {
      if (position.tp == null) continue;
      const touched = position.side === BUY ? bar.h >= position.tp : bar.l + state.spread <= position.tp;
      // Filled at the level itself, never better.
      if (touched) events.push({ type: "tp", trade: settle(state, position, position.tp, "tp", bar.t) });
    }
    sweep(state, second, bar.c, bar.t, rules, events);
  }
  state.price = bar.c;
  observe(state, equityAt(state, bar.c));
  // A forced liquidation that leaves nothing open ends the round.
  if (events.some((event) => event.type === "stopout") && !state.positions.length) state.status = "liquidated";
  return events;
}

/** End of the replay: everything still open is closed at the last price. */
export function finish(state) {
  if (state.status !== "open") return [];
  const trades = closeAll(state, "end");
  observe(state, state.balance);
  state.status = "finished";
  return trades;
}

export function result(state, rules = RULES) {
  const equity = summary(state).equity;
  const wins = state.closed.filter((trade) => trade.profit > 0).length;
  return {
    status: state.status,
    equity,
    profit: equity - rules.initialBalance,
    returnPct: ((equity - rules.initialBalance) / rules.initialBalance) * 100,
    maxDrawdownPct: state.maxDrawdown * 100,
    trades: state.closed.length,
    wins,
    best: state.closed.reduce((max, trade) => Math.max(max, trade.profit), 0),
    worst: state.closed.reduce((min, trade) => Math.min(min, trade.profit), 0),
  };
}

/**
 * What the same bars did to someone who bought everything the leverage allows
 * at the start and never touched it again, forced liquidation included.
 */
export function allInBuyAndHold(pair, startPrice, bars, rules = RULES) {
  const state = createAccount(pair, rules);
  mark(state, startPrice, bars[0]?.t ?? null);
  const opened = openPosition(state, { side: BUY, lots: maxLots(state, rules) }, rules);
  let liquidatedAt = null;
  if (opened.ok) {
    for (const bar of bars) {
      step(state, bar, rules);
      if (state.status === "liquidated") {
        liquidatedAt = bar.t;
        break;
      }
    }
  }
  finish(state);
  return { ...result(state, rules), lots: opened.ok ? opened.position.lots : 0, liquidatedAt };
}

/** The same without leverage: a position worth exactly the balance, bought at the ask, valued at the last bid. */
export function unleveragedBuyAndHold(pair, startPrice, bars, rules = RULES) {
  const ask = startPrice + rules.spread[pair];
  const last = bars.length ? bars[bars.length - 1].c : startPrice;
  const returnPct = ((last - ask) / ask) * 100;
  return { returnPct, equity: Math.round(rules.initialBalance * (1 + returnPct / 100)) };
}
