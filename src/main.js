// The page: scenario list, the replay with its order ticket and account
// line, and the result of a round. All trading maths is in ./engine/.
import {
  closeAll, closePosition, createAccount, finish, lotsForLeverage, mark, maxLots, openPosition, orderLeverage,
  positionLeverage, profitAt, quote, result, step, summary, unleveragedBuyAndHold,
} from "./engine/engine.js";
import { bucketStart } from "./engine/aggregate.js";
import { REPLAY, RULES } from "./engine/rules.js";
import { createChart } from "./chart.js";
import { loadBars, loadIndex } from "./data.js";
import { clock, dateTime, duration, escapeHtml, lots as fmtLots, multiple, pairName, percent, price, signedYen, timeOfDay, tone, yen } from "./format.js";
import { allBests, bestOf, loadPrefs, loadRound, loadSettings, recordResult, savePrefs, saveRound, saveSettings, syncCloud } from "./storage.js";
import { applyPalette, cssColor, otherPalette, palette, paletteName } from "./theme.js";
import { hasRank, myRank, openAuthorSpace, prepareNavigate, rankList, returnOf, submitScore, watchSafeArea } from "./toy.js";

const $ = (id) => document.getElementById(id);
const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>',
  step: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5v11l7-5.5zM11 2.5h2.5v11H11z"/></svg>',
};
const SIDE = { buy: "多", sell: "空" };
const REASON = { manual: "手动", sl: "止损", tp: "止盈", stopout: "强平", end: "结算" };
const ORDER_ERROR = {
  closed: "本局已结束",
  lots: `最少 ${RULES.minLots} 手`,
  margin: `超过 ${RULES.leverage} 倍杠杆上限，开不了这么多`,
  sl: "止损离现价太近",
  tp: "止盈离现价太近",
};

const prefs = { pair: "USDJPY", timeframe: REPLAY.defaultTimeframe, lots: 1, sl: "", tp: "", ...loadPrefs() };
if (!REPLAY.timeframes.includes(prefs.timeframe)) prefs.timeframe = REPLAY.defaultTimeframe;
const remember = (patch) => savePrefs(Object.assign(prefs, patch));

const app = {
  index: null,
  /** The round on screen: scenario, bars, account and where the replay stands. */
  round: null,
  chart: null,
  rank: false,
};

// ---------- small DOM helpers ----------

const written = new WeakMap();
/** Sets text only when it changed; the account line is written every frame. */
function text(element, value) {
  if (written.get(element) === value) return;
  written.set(element, value);
  element.textContent = value;
}
function setTone(element, value) {
  element.dataset.tone = tone(value);
}
function show(screen) {
  for (const id of ["home", "game"]) $(id).hidden = id !== screen;
}
function toast(message, kind = "info") {
  const item = document.createElement("div");
  item.className = `toast ${kind}`;
  item.textContent = message;
  $("toasts").append(item);
  while ($("toasts").children.length > 3) $("toasts").firstChild.remove();
  setTimeout(() => item.remove(), 2600);
}
function segment(container, items, current, onPick) {
  container.innerHTML = items.map(({ value, label }) =>
    `<button type="button" data-value="${escapeHtml(value)}" aria-pressed="${value === current}">${escapeHtml(label)}</button>`).join("");
  container.onclick = (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    for (const item of container.children) item.setAttribute("aria-pressed", String(item === button));
    onPick(button.dataset.value);
  };
}
function openModal(id) {
  $(id).hidden = false;
}
for (const modal of document.querySelectorAll(".modal")) {
  modal.addEventListener("click", (event) => {
    // The result stays until one of its own buttons is used.
    if (modal.id !== "result" && (event.target === modal || event.target.closest("[data-close]"))) modal.hidden = true;
  });
}

// ---------- scenario list ----------

function renderHome() {
  const { scenarios, pairs } = app.index;
  if (!pairs.includes(prefs.pair)) prefs.pair = pairs[0];
  segment($("pair-seg"), pairs.map((pair) => ({ value: pair, label: pairName(pair) })), prefs.pair, (pair) => {
    remember({ pair });
    renderHome();
  });

  $("scenarios").innerHTML = scenarios.map((scenario) => {
    const data = scenario.pairs[prefs.pair];
    if (!data) {
      return `<li><button type="button" class="scenario" disabled>
        <span class="s-date">${escapeHtml(scenario.date)}</span>
        <span class="s-title">${escapeHtml(scenario.title)}</span>
        <span class="s-meta"><i>${pairName(prefs.pair)} 没有这段数据</i></span>
      </button></li>`;
    }
    const best = bestOf(scenario.id, prefs.pair);
    return `<li><button type="button" class="scenario" data-id="${escapeHtml(scenario.id)}">
      <span class="s-date">${escapeHtml(scenario.date)}</span>
      <span class="s-title">${escapeHtml(scenario.title)}</span>
      <span class="s-blurb">${escapeHtml(scenario.blurb)}</span>
      <span class="s-meta">
        <i>振幅 ${data.range.toFixed(2)} 日元（${data.rangePct.toFixed(1)}%）</i>
        <i>回放 ${duration(data.to - data.from)}</i>
        ${best ? `<i class="best" data-tone="${tone(best.returnPct)}">最佳 ${percent(best.returnPct)}</i>` : "<i>未挑战</i>"}
      </span>
    </button></li>`;
  }).join("");

  const saved = loadRound();
  const scenario = saved && scenarios.find((item) => item.id === saved.scenarioId);
  const resume = $("resume");
  resume.hidden = !scenario?.pairs[saved.pair];
  if (!resume.hidden) {
    const data = scenario.pairs[saved.pair];
    const done = Math.round(((saved.cursor - data.context) / (data.bars - data.context)) * 100);
    resume.innerHTML = `<b>继续上一局</b><span>${escapeHtml(scenario.title)} · ${pairName(saved.pair)} · 进度 ${done}% · 净值 ${yen(summary(saved.account).equity)}</span>`;
    resume.onclick = () => startRound(scenario, saved.pair, saved);
  }
}

$("scenarios").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  const scenario = button && app.index.scenarios.find((item) => item.id === button.dataset.id);
  if (scenario) startRound(scenario, prefs.pair);
});

// ---------- a round ----------

async function startRound(scenario, pair, saved = null) {
  let data;
  try {
    data = await loadBars(scenario, pair);
  } catch {
    $("home-note").textContent = "这段数据没有读出来，请再试一次。";
    return;
  }
  const { bars, context } = data;
  // A round saved against other data (the scenario was rebuilt) cannot be continued.
  if (saved && !(saved.cursor >= context && saved.cursor < bars.length)) saved = null;
  const account = saved?.account ?? createAccount(pair);
  if (!saved) mark(account, bars[context - 1].c, bars[context - 1].t);
  app.round = {
    scenario, pair, bars, context, account,
    /** Bars revealed so far, context included. */
    cursor: saved?.cursor ?? context,
    playing: false,
    /** One-minute bars per second; every round starts at the default. */
    speed: REPLAY.defaultSpeed,
    /** Set once the round is over: outcome, benchmarks, record. */
    ended: null,
    tab: "open",
  };

  show("game");
  $("game").classList.remove("sheet-open", "over");
  $("result").hidden = true;
  text($("g-pair"), pairName(pair));
  text($("g-title"), scenario.title);
  $("btn-end").textContent = "结算";
  $("toasts").replaceChildren();
  rows.open.clear();
  $("open-rows").replaceChildren();
  $("closed-rows").replaceChildren();
  pickTab("open");

  app.chart?.destroy();
  app.chart = createChart($("chart"), pair);
  app.chart.show(bars.slice(0, app.round.cursor), prefs.timeframe);
  refreshLevels();
  renderClosed();
  render();
  // A new round starts running at once. One that is continued waits: whoever
  // comes back to it wants a look at where things stand first.
  if (!saved) setPlaying(true);
}

function persistRound() {
  const round = app.round;
  if (!round || round.ended) return;
  saveRound({ scenarioId: round.scenario.id, pair: round.pair, cursor: round.cursor, account: round.account });
}

/** Reveals the next one-minute bar and lets the account live through it. */
function advance() {
  const round = app.round;
  if (round.ended) return;
  const bar = round.bars[round.cursor++];
  const events = step(round.account, bar);
  app.chart.push(bar);
  for (const { type, trade } of events) {
    toast(`${REASON[type]} · ${SIDE[trade.side]} ${fmtLots(trade.lots)} 手 ${signedYen(trade.profit)}`, trade.profit >= 0 ? "gain" : "loss");
  }
  if (events.length) {
    refreshLevels();
    renderClosed();
  }
  if (round.account.status === "liquidated" || round.cursor >= round.bars.length) endRound(false);
  else if (round.cursor % 30 === 0) persistRound();
}

let frame = 0;
let lastFrame = 0;
let owed = 0;
function loop(now) {
  const round = app.round;
  if (!round?.playing) return;
  owed += Math.min(0.25, (now - lastFrame) / 1000) * round.speed;
  lastFrame = now;
  while (owed >= 1 && round.playing) {
    owed -= 1;
    advance();
  }
  render();
  if (round.playing) frame = requestAnimationFrame(loop);
}
function setPlaying(playing) {
  const round = app.round;
  if (!round || round.ended || round.playing === playing) return;
  round.playing = playing;
  cancelAnimationFrame(frame);
  if (playing) {
    owed = 0;
    lastFrame = performance.now();
    frame = requestAnimationFrame(loop);
  } else {
    persistRound();
  }
  render();
}
/** One bar of the period on screen: runs to the end of the bar that is forming. */
function stepOnce() {
  const round = app.round;
  if (!round || round.ended) return;
  setPlaying(false);
  const bucket = (index) => bucketStart(round.bars[index].t, prefs.timeframe);
  do advance();
  while (!round.ended && bucket(round.cursor) === bucket(round.cursor - 1));
  persistRound();
  render();
}

function endRound(early) {
  const round = app.round;
  if (round.ended) return;
  round.playing = false;
  cancelAnimationFrame(frame);
  const liquidated = round.account.status === "liquidated";
  finish(round.account);
  const outcome = result(round.account);
  const played = round.bars.slice(round.context, round.cursor);
  const start = round.bars[round.context - 1].c;
  // A round without a single trade is not a result worth keeping.
  const counts = outcome.trades > 0;
  round.ended = {
    outcome,
    early,
    liquidated,
    plain: unleveragedBuyAndHold(round.pair, start, played),
    record: counts && recordResult(round.scenario.id, round.pair, outcome),
    counts,
  };
  saveRound(null);
  $("game").classList.add("over");
  $("game").classList.remove("sheet-open");
  $("btn-end").textContent = "结果";
  refreshLevels();
  renderClosed();
  render();
  showResult();
}

// ---------- order ticket ----------

const lotsInput = $("lots-input");
function readLots() {
  const value = Number(lotsInput.value);
  if (!Number.isFinite(value) || value <= 0) return RULES.minLots;
  return Math.max(RULES.minLots, Math.round(value / RULES.lotStep) * RULES.lotStep);
}
function writeLots(value) {
  const clean = Number(Math.max(RULES.minLots, value).toFixed(1));
  lotsInput.value = fmtLots(clean);
  remember({ lots: clean });
  renderHint();
}
const pipsOf = (input) => {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : null;
};
/** Says what the order in the ticket would weigh: itself and together with what is open, in multiples of the equity. */
function renderHint() {
  const round = app.round;
  if (!round) return;
  const { account } = round;
  if (round.ended) {
    text($("ticket-hint"), "本局已结束。");
    $("ticket-hint").dataset.tone = "flat";
    return;
  }
  const order = orderLeverage(account, readLots());
  const { leverage } = summary(account);
  text($("lots-lev"), order == null ? "" : `≈ ${multiple(order)}`);
  const hint = $("ticket-hint");
  if (order == null || leverage == null) {
    text(hint, "净值已经亏完，开不了新仓。");
    hint.dataset.tone = "warn";
    return;
  }
  const fits = readLots() <= maxLots(account) + 1e-9;
  text(hint, `这一单 ≈ 本金的 ${multiple(order, " 倍")} · 下单后合计 ${multiple(leverage + order, " 倍")}（上限 ${RULES.leverage} 倍${fits ? "" : "，超了"}）`);
  hint.dataset.tone = fits ? "flat" : "warn";
}

function trade(side) {
  const round = app.round;
  if (!round || round.ended) return;
  const { bid, ask } = quote(round.account);
  const entry = side === "buy" ? ask : bid;
  const away = side === "buy" ? -1 : 1;
  const sl = pipsOf($("sl-input"));
  const tp = pipsOf($("tp-input"));
  const level = (pips, direction) => (pips ? Number((entry + direction * pips * RULES.pip).toFixed(RULES.priceDecimals)) : null);
  const answer = openPosition(round.account, { side, lots: readLots(), sl: level(sl, away), tp: level(tp, -away) });
  if (!answer.ok) {
    toast(ORDER_ERROR[answer.reason] ?? "下单失败", "warn");
    return;
  }
  const { position } = answer;
  toast(`${side === "buy" ? "买入" : "卖出"} ${fmtLots(position.lots)} 手 @ ${price(position.open)}`);
  afterTrade();
}
function afterTrade() {
  refreshLevels();
  renderClosed();
  persistRound();
  render();
}

function refreshLevels() {
  const round = app.round;
  const levels = [];
  for (const position of round.account.positions) {
    const color = (position.side === "buy" ? palette().up : palette().down).line;
    levels.push({ price: position.open, label: `${SIDE[position.side]} ${fmtLots(position.lots)}`, color, solid: true });
    if (position.sl != null) levels.push({ price: position.sl, label: "止损", color: cssColor("--muted") });
    if (position.tp != null) levels.push({ price: position.tp, label: "止盈", color: cssColor("--accent") });
  }
  app.chart.setLevels(levels);
}

// ---------- rendering ----------

const rows = { open: new Map() };
function renderOpenRows(account) {
  const list = $("open-rows");
  const ids = account.positions.map((position) => position.id);
  const same = ids.length === rows.open.size && ids.every((id) => rows.open.has(id));
  if (!same) {
    rows.open.clear();
    list.replaceChildren(...account.positions.map((position) => {
      const item = document.createElement("li");
      const levels = [position.sl != null && `止损 ${price(position.sl)}`, position.tp != null && `止盈 ${price(position.tp)}`].filter(Boolean).join(" · ");
      item.innerHTML = `<span class="tag ${position.side}">${SIDE[position.side]}</span>
        <span class="what"><b>${fmtLots(position.lots)} 手</b> <i>${price(position.open)}</i> <em></em>${levels ? `<small>${levels}</small>` : ""}</span>
        <b class="pnl"></b>
        <button type="button" class="ghost" data-close-id="${position.id}">平仓</button>`;
      rows.open.set(position.id, { pnl: item.querySelector(".pnl"), weight: item.querySelector("em") });
      return item;
    }));
    if (!ids.length) list.innerHTML = '<li class="empty">没有持仓。点「买入」或「卖出」开一笔。</li>';
  }
  for (const position of account.positions) {
    const { pnl, weight } = rows.open.get(position.id);
    const profit = profitAt(account, position, account.price);
    text(pnl, signedYen(profit));
    setTone(pnl, profit);
    text(weight, multiple(positionLeverage(account, position)));
  }
}
function renderClosed() {
  const { closed } = app.round.account;
  text($("n-closed"), String(closed.length));
  $("closed-rows").innerHTML = closed.length
    ? [...closed].reverse().map((trade) => `<li>
        <span class="tag ${trade.side}">${SIDE[trade.side]}</span>
        <span class="what"><b>${fmtLots(trade.lots)} 手</b> <i>${price(trade.open)} → ${price(trade.close)}</i><small>${REASON[trade.reason]} · ${timeOfDay(trade.closeTime)}</small></span>
        <b class="pnl" data-tone="${tone(trade.profit)}">${signedYen(trade.profit)}</b>
      </li>`).join("")
    : '<li class="empty">还没有平仓记录。</li>';
}
function pickTab(tab) {
  if (app.round) app.round.tab = tab;
  for (const button of document.querySelectorAll(".tab")) button.setAttribute("aria-pressed", String(button.dataset.tab === tab));
  $("open-rows").hidden = tab !== "open";
  $("closed-rows").hidden = tab !== "closed";
}

function render() {
  const round = app.round;
  if (!round) return;
  const { account } = round;
  const line = summary(account);
  text($("a-balance"), yen(line.balance));
  text($("a-equity"), yen(line.equity));
  text($("a-margin"), yen(line.margin));
  text($("a-free"), yen(line.freeMargin));
  text($("a-level"), line.marginLevel == null ? "—" : `${Math.min(99_999, line.marginLevel * 100).toFixed(0)}%`);
  text($("a-leverage"), multiple(line.leverage));
  // Warn while the next few percent would trigger forced liquidation.
  const close = line.marginLevel != null && line.marginLevel < RULES.stopOutLevel * 1.5;
  $("a-level").dataset.tone = close ? "warn" : "flat";
  $("a-leverage").dataset.tone = close ? "warn" : "flat";
  text($("a-floating"), signedYen(line.floating));
  setTone($("a-floating"), line.floating);

  const { bid, ask } = quote(account);
  text($("q-bid"), price(bid));
  text($("q-ask"), price(ask));
  text($("g-clock"), `${clock(account.time)} ${REPLAY.timezoneLabel}`);
  const total = round.bars.length - round.context;
  $("g-progress").style.width = `${(((round.cursor - round.context) / total) * 100).toFixed(2)}%`;

  const over = Boolean(round.ended);
  $("btn-play").innerHTML = round.playing ? ICON.pause : ICON.play;
  $("btn-play").setAttribute("aria-label", round.playing ? "暂停" : "播放");
  for (const id of ["btn-play", "btn-step", "btn-sell", "btn-buy"]) $(id).disabled = over;
  text($("btn-speed"), `${round.speed}×`);
  text($("n-open"), String(account.positions.length));
  text($("n-open-2"), String(account.positions.length));
  $("btn-close-all").disabled = over || !account.positions.length;
  renderOpenRows(account);
  renderHint();
}

// ---------- result ----------

function showResult() {
  const round = app.round;
  const { outcome, early, liquidated, plain, record, counts } = round.ended;
  const played = round.bars.slice(round.context, round.cursor);
  text($("r-heading"), liquidated ? "爆仓了" : early ? "提前结算" : "回放结束");
  text($("r-sub"), `${round.scenario.title} · ${pairName(round.pair)} · ${dateTime(played[0]?.t ?? round.account.time)} 起 ${duration(played.length * 60)}`);
  text($("r-return"), percent(outcome.returnPct));
  setTone($("r-return"), outcome.returnPct);
  text($("r-equity"), yen(outcome.equity));
  $("r-stats").innerHTML = [
    ["最大回撤", `${outcome.maxDrawdownPct.toFixed(2)}%`],
    ["交易次数", `${outcome.trades} 笔`],
    ["盈利笔数", `${outcome.wins} 笔`],
    ["最好一笔", signedYen(outcome.best)],
    ["最差一笔", signedYen(outcome.worst)],
    ["初始资金", yen(RULES.initialBalance)],
  ].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");

  $("r-compare").innerHTML = `<tr><th>同一段行情</th><th>收益率</th><th></th></tr>` + [
    ["你", outcome.returnPct, `${outcome.trades} 笔交易`],
    ["1 倍杠杆买入持有", plain.returnPct, "开局买入，不加杠杆，拿到最后"],
    ["不动", 0, "一直空仓"],
  ].map(([label, value, note], index) =>
    `<tr${index ? "" : ' class="you"'}><td>${label}</td><td data-tone="${tone(value)}">${percent(value)}</td><td>${note}</td></tr>`).join("");

  const best = bestOf(round.scenario.id, round.pair);
  text($("r-record"), !counts ? "没有交易，这一局不计成绩。"
    : record ? "这是你在这个场景、这个品种上的新纪录。"
      : `你在这里的最好成绩是 ${percent(best.returnPct)}。`);

  const rank = $("r-rank");
  rank.hidden = !app.rank;
  if (app.rank) {
    rank.textContent = counts ? "正在提交成绩…" : "";
    (counts ? submitScore(outcome.returnPct) : Promise.resolve(null)).then((sent) => renderRank(rank, sent === false ? "成绩没有提交上去。" : ""));
  }
  openModal("result");
}

/** Fills `target` with the leaderboard, or with this device's best results when there is none. */
async function renderRank(target, note = "") {
  const [list, mine] = app.rank ? await Promise.all([rankList(20), myRank()]) : [null, null];
  if (!list) {
    const titles = new Map(app.index.scenarios.map((scenario) => [scenario.id, scenario.title]));
    const local = Object.entries(allBests())
      .map(([key, best]) => ({ id: key.split("|")[0], pair: key.split("|")[1], ...best }))
      .filter((best) => titles.has(best.id))
      .sort((a, b) => b.returnPct - a.returnPct);
    target.innerHTML = `<p class="rank-note">${app.rank ? "排行榜暂时读不出来。" : "排行榜只在 B 站里有。"}下面是这台设备上的最好成绩。</p>` + (local.length
      ? `<ol>${local.slice(0, 20).map((best, index) => `<li><i>${index + 1}</i><span>${escapeHtml(titles.get(best.id))} · ${pairName(best.pair)}</span><b data-tone="${tone(best.returnPct)}">${percent(best.returnPct)}</b></li>`).join("")}</ol>`
      : '<p class="rank-note">还没有成绩。</p>');
    return;
  }
  target.innerHTML = (note ? `<p class="rank-note">${note}</p>` : "")
    + (mine ? `<p class="rank-note">我的排名：第 ${mine.rank} 名，${percent(returnOf(mine.score))}</p>` : "")
    + (list.length
      ? `<ol>${list.map((row) => `<li${row.self ? ' class="you"' : ""}><i>${row.rank}</i><span>${escapeHtml(row.name)}</span><b data-tone="${tone(row.score)}">${percent(returnOf(row.score))}</b></li>`).join("")}</ol>`
      : '<p class="rank-note">还没有人上榜。</p>');
}

function renderRules() {
  const spreads = Object.entries(RULES.spread).map(([pair, spread]) => `${pairName(pair)} ${(spread / RULES.pip).toFixed(1)} 点`).join("、");
  $("rule-list").innerHTML = [
    `每局初始资金 ${yen(RULES.initialBalance)} 日元（虚拟），杠杆 ${RULES.leverage} 倍，1 手 = ${yen(RULES.lotUnits)} 单位基础货币，最少 ${RULES.minLots} 手。`,
    `图上画的是买价。买入按买价加点差成交、按买价平仓；卖出按买价成交、按买价加点差平仓。点差固定：${spreads}（1 点 = ${RULES.pip} 日元）。`,
    "未来的 K 线看不到。可以暂停、单步、调倍速，周期只影响显示，成交和判定都按 1 分钟线。",
    `仓位大小用「实际杠杆」来看：持仓的日元价值 ÷ 当前净值。5× 就是手里的仓位值本金的 5 倍，价格每动 1%，净值动 5%。多单和空单的价值相加，不互相抵消；上限 ${RULES.leverage} 倍。`,
    "止损、止盈按距离开仓价的点数填写，留空就是不设。可以同时持有多笔，也可以做空。",
    `维持率（净值 ÷ 已用保证金）跌破 ${(RULES.stopOutLevel * 100).toFixed(0)}% 时强制平仓，从亏损最大的一笔开始，直到维持率恢复；仓位被全部强平，本局结束。`,
    "一根 K 线只知道开高低收，不知道先后。判定时按对你不利的顺序走：开盘 → 对净持仓不利的一端 → 另一端 → 收盘；途中先碰到的止损或强平线先执行，止盈放到最后。所以同一根里止损和止盈都碰到，算止损。",
    "跳空越过止损或强平线时，按那根 K 线的开盘价成交；止盈只按设定的价格成交，不会更好。",
    "回放结束时，没平的仓位按最后一个价格平掉再结算。没有交易的一局不计成绩。",
  ].map((rule) => `<li>${rule}</li>`).join("");
}

// ---------- wiring ----------

$("btn-back").onclick = () => {
  setPlaying(false);
  persistRound();
  app.chart?.destroy();
  app.chart = null;
  app.round = null;
  $("result").hidden = true;
  show("home");
  renderHome();
};
$("btn-play").onclick = () => setPlaying(!app.round.playing);
$("btn-step").onclick = stepOnce;
$("btn-speed").onclick = () => {
  const round = app.round;
  round.speed = REPLAY.speeds[(REPLAY.speeds.indexOf(round.speed) + 1) % REPLAY.speeds.length];
  render();
};
let endArmed = 0;
$("btn-end").onclick = () => {
  const round = app.round;
  if (round.ended) return openModal("result");
  // Ending early cannot be undone, so it takes a second tap.
  if (Date.now() - endArmed > 3000) {
    endArmed = Date.now();
    $("btn-end").textContent = "确认结算";
    setTimeout(() => {
      if (!app.round?.ended) $("btn-end").textContent = "结算";
    }, 3000);
    return;
  }
  endArmed = 0;
  endRound(true);
};
$("btn-buy").onclick = () => trade("buy");
$("btn-sell").onclick = () => trade("sell");
$("lots-minus").onclick = () => writeLots(readLots() - (readLots() > 1 ? 1 : RULES.lotStep));
$("lots-plus").onclick = () => writeLots(readLots() + (readLots() >= 1 ? 1 : RULES.lotStep));
lotsInput.onchange = () => writeLots(readLots());
$("sl-input").onchange = () => remember({ sl: $("sl-input").value });
$("tp-input").onchange = () => remember({ tp: $("tp-input").value });
$("lot-chips").onclick = (event) => {
  const button = event.target.closest("button[data-leverage]");
  if (!button || !app.round) return;
  const { account } = app.round;
  writeLots(button.dataset.leverage === "max" ? maxLots(account) : lotsForLeverage(account, Number(button.dataset.leverage)));
};
$("btn-close-all").onclick = () => {
  const trades = closeAll(app.round.account);
  if (trades.length) toast(`全部平仓 ${signedYen(trades.reduce((sum, item) => sum + item.profit, 0))}`);
  afterTrade();
};
$("open-rows").onclick = (event) => {
  const button = event.target.closest("button[data-close-id]");
  if (!button || app.round.ended) return;
  const closed = closePosition(app.round.account, Number(button.dataset.closeId));
  if (closed) toast(`平仓 · ${SIDE[closed.side]} ${fmtLots(closed.lots)} 手 ${signedYen(closed.profit)}`, closed.profit >= 0 ? "gain" : "loss");
  afterTrade();
};
for (const button of document.querySelectorAll(".tab")) button.onclick = () => pickTab(button.dataset.tab);
$("btn-sheet").onclick = () => $("game").classList.toggle("sheet-open");
$("r-again").onclick = () => startRound(app.round.scenario, app.round.pair);
$("r-home").onclick = () => $("btn-back").onclick();
$("r-look").onclick = () => {
  $("result").hidden = true;
};
$("btn-author").onclick = openAuthorSpace;
$("r-author").onclick = openAuthorSpace;
$("btn-palette").onclick = () => {
  saveSettings({ palette: otherPalette() });
  usePalette();
};
$("btn-rules").onclick = () => {
  renderRules();
  openModal("rules");
};
$("btn-rank").onclick = () => {
  $("rank-body").textContent = "读取中…";
  openModal("rank");
  renderRank($("rank-body"));
};

document.addEventListener("keydown", (event) => {
  if (!app.round || app.round.ended || event.target.closest("input") || !$("result").hidden) return;
  if (event.code === "Space") {
    event.preventDefault();
    setPlaying(!app.round.playing);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    stepOnce();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPlaying(false);
});
window.addEventListener("pagehide", persistRound);
new ResizeObserver(() => app.chart?.resize()).observe($("chart"));

/** Puts the saved colour scheme on the page, the chart and its level lines. */
function usePalette() {
  applyPalette(loadSettings().palette);
  text($("palette-label"), palette().label);
  $("btn-palette").setAttribute("aria-label", `涨跌配色：${palette().label}，点击切换`);
  if (app.round) {
    app.chart.restyle();
    refreshLevels();
  }
}

async function boot() {
  usePalette();
  watchSafeArea();
  prepareNavigate();
  $("btn-step").innerHTML = ICON.step;
  $("lot-chips").innerHTML = "<span>本金的</span>"
    + RULES.leverageChoices.map((value) => `<button type="button" data-leverage="${value}">${value}×</button>`).join("")
    + '<button type="button" data-leverage="max">最大</button>';
  lotsInput.value = fmtLots(prefs.lots);
  $("sl-input").value = prefs.sl;
  $("tp-input").value = prefs.tp;
  segment($("tf-seg"), REPLAY.timeframes.map((minutes) => ({ value: String(minutes), label: `${minutes}分` })), String(prefs.timeframe), (value) => {
    remember({ timeframe: Number(value) });
    app.chart?.setTimeframe(prefs.timeframe);
    refreshLevels();
  });

  try {
    app.index = await loadIndex();
  } catch {
    $("home-note").textContent = "场景数据没有读出来，请刷新再试。";
    return;
  }
  text($("home-lead"), `历史大行情的 ${app.index.granularity} 分钟线逐根回放，用 ${yen(RULES.initialBalance)} 虚拟日元练手。`);
  text($("home-note"), `行情数据：${app.index.source} 的历史报价（买价），时间按${REPLAY.timezoneLabel}显示。`);
  renderHome();
  // Bests saved in the cloud and the leaderboard arrive when the SDK does.
  hasRank().then((available) => {
    app.rank = available;
  });
  syncCloud().then((changed) => {
    if (changed.settings && paletteName() !== loadSettings().palette) usePalette();
    if (changed.bests && !app.round) renderHome();
  });
}
boot();
