// Every number of the game that someone may want to tune lives here.
// The engine takes these as an argument; nothing else hard-codes them.
export const RULES = {
  /** Starting balance of a round, in (virtual) yen. */
  initialBalance: 1_000_000,
  /** Margin for a position is its notional value divided by this. */
  leverage: 25,
  /** Units of the base currency in one lot (1 手 = 1 万通貨). */
  lotUnits: 10_000,
  /** Smallest order and the grid lots are rounded to. */
  minLots: 0.1,
  lotStep: 0.1,
  /**
   * One-tap order sizes next to the stepper, as multiples of the current
   * equity: 5 means an order worth five times what the account holds.
   */
  leverageChoices: [1, 5, 10],
  /**
   * Forced liquidation starts when equity / used margin falls below this
   * (1 = 100%). Positions are closed one at a time, largest loss first.
   */
  stopOutLevel: 1,
  /** Fixed spread per pair in yen; the chart shows bid, buys fill at bid + spread. */
  spread: { USDJPY: 0.003, EURJPY: 0.005, AUDJPY: 0.006 },
  /** One pip of a yen pair, in yen. Stop-loss and take-profit are entered in pips. */
  pip: 0.01,
  /** Decimals a yen pair is quoted with. */
  priceDecimals: 3,
};

/** How the replay is shown and driven; nothing here changes a result. */
export const REPLAY = {
  /** Chart periods in minutes, aggregated from the one-minute bars. */
  timeframes: [1, 5, 15],
  defaultTimeframe: 5,
  /** One-minute bars revealed per second. */
  speeds: [1, 2, 5, 10, 30],
  /** Every new round starts playing at this speed. */
  defaultSpeed: 1,
  /** Clock and chart axis: hours ahead of UTC and what to call it. */
  utcOffsetHours: 8,
  timezone: "Asia/Shanghai",
  timezoneLabel: "北京时间",
};
