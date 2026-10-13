// The KLineChart instance of a round. It only ever holds the bars revealed
// so far: the future is not in the chart at all, so no scroll or zoom can
// show it.
import { dispose, init, registerOverlay } from "klinecharts";
import { aggregate, merge } from "./engine/aggregate.js";
import { REPLAY, RULES } from "./engine/rules.js";
import { cssColor, palette } from "./theme.js";

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';
const SANS = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const LEVEL = "levelLine";

let registered = false;
function registerLevelLine() {
  if (registered) return;
  registered = true;
  // A dashed line across the pane with a small tag: entry, stop-loss or take-profit.
  registerOverlay({
    name: LEVEL,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, bounding, overlay }) => {
      const y = coordinates[0]?.y;
      if (y == null) return [];
      const { color, label, solid } = overlay.extendData;
      return [
        {
          type: "line",
          attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] },
          styles: { style: solid ? "solid" : "dashed", dashedValue: [4, 4], color, size: 1 },
          ignoreEvent: true,
        },
        {
          type: "text",
          attrs: { x: 4, y: y - 2, text: label, align: "left", baseline: "bottom" },
          styles: {
            style: "fill", color, size: 10, family: SANS, weight: "normal",
            backgroundColor: "rgba(11, 14, 17, 0.72)", borderSize: 0, borderRadius: 2,
            paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1,
          },
          ignoreEvent: true,
        },
      ];
    },
  });
}

/** The chart's look, from the stylesheet's colours and the palette in use. */
function buildStyles() {
  const { up, down } = palette();
  const text = cssColor("--muted");
  const line = cssColor("--line");
  const grid = cssColor("--hair");
  const axis = {
    axisLine: { color: line },
    tickLine: { color: line },
    tickText: { color: text, family: MONO, size: 10 },
  };
  const cross = { line: { color: text }, text: { family: MONO, size: 10, backgroundColor: line, borderColor: line } };
  return {
    grid: { horizontal: { color: grid }, vertical: { color: grid } },
    candle: {
      bar: {
        upColor: up.line, downColor: down.line, noChangeColor: text,
        upBorderColor: up.line, downBorderColor: down.line, noChangeBorderColor: text,
        upWickColor: up.line, downWickColor: down.line, noChangeWickColor: text,
      },
      priceMark: {
        high: { color: text, textFamily: MONO, textSize: 10 },
        low: { color: text, textFamily: MONO, textSize: 10 },
        last: {
          upColor: up.line, downColor: down.line, noChangeColor: text,
          text: { family: MONO, size: 10 },
        },
      },
      tooltip: {
        showRule: "follow_cross",
        title: { show: false },
        legend: {
          color: text, family: MONO, size: 10,
          template: [
            { title: "", value: "{time}" },
            { title: "开", value: "{open}" },
            { title: "高", value: "{high}" },
            { title: "低", value: "{low}" },
            { title: "收", value: "{close}" },
          ],
        },
      },
    },
    xAxis: axis,
    yAxis: axis,
    separator: { color: line },
    crosshair: { horizontal: cross, vertical: cross },
  };
}

const toKLine = (bar) => ({ timestamp: bar.t * 1000, open: bar.o, high: bar.h, low: bar.l, close: bar.c });

export function createChart(element, pair) {
  registerLevelLine();
  const chart = init(element, { locale: "zh-CN", timezone: REPLAY.timezone, styles: "dark" });
  chart.setStyles(buildStyles());

  /** One-minute bars revealed so far, and the same in the period shown. */
  let revealed = [];
  let series = [];
  let minutes = REPLAY.defaultTimeframe;
  let emit = null;
  let lineIds = [];

  chart.setDataLoader({
    getBars: ({ type, callback }) => callback(type === "init" ? series.map(toKLine) : [], false),
    subscribeBar: ({ callback }) => {
      emit = callback;
    },
    unsubscribeBar: () => {
      emit = null;
    },
  });
  chart.setSymbol({ ticker: pair, pricePrecision: RULES.priceDecimals, volumePrecision: 0 });

  const fit = () => {
    const width = element.clientWidth || 360;
    // Around 70 bars on a phone, 140 on a desktop.
    chart.setBarSpace(Math.max(4, Math.min(9, width / 90)));
    chart.setOffsetRightDistance(Math.min(64, width * 0.08));
  };
  // Either call makes the chart pull `series` through the loader again.
  const reload = () => {
    series = aggregate(revealed, minutes);
    if (chart.getPeriod()?.span === minutes) chart.resetData();
    else chart.setPeriod({ type: "minute", span: minutes });
  };

  return {
    /** Replaces everything shown: the bars revealed so far, in `period` minutes. */
    show(bars, period) {
      revealed = bars.slice();
      minutes = period;
      fit();
      reload();
    },
    setTimeframe(period) {
      if (period === minutes) return;
      minutes = period;
      reload();
    },
    /** Reveals one more one-minute bar. */
    push(bar) {
      revealed.push(bar);
      const forming = merge(series, bar, minutes);
      emit?.(toKLine(forming));
    },
    /** `levels`: `{ price, label, color, solid }` drawn as horizontal lines; replaces the previous set. */
    setLevels(levels) {
      for (const id of lineIds) chart.removeOverlay({ id });
      const timestamp = (series[series.length - 1]?.t ?? 0) * 1000;
      lineIds = levels.map((level) => chart.createOverlay({
        name: LEVEL,
        lock: true,
        points: [{ timestamp, value: level.price }],
        extendData: level,
      })).filter(Boolean);
    },
    /** Takes the colours again after the palette changed. */
    restyle() {
      chart.setStyles(buildStyles());
    },
    resize() {
      chart.resize();
    },
    destroy() {
      dispose(element);
    },
  };
}
