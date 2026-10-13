// The picture a player sends to a friend: the result of one round, a small
// chart of it and the QR code of its challenge link. Drawn on a canvas with
// system fonts only; everything it shows is handed in, nothing is fetched.
const W = 1080;
const H = 1440;
const PAD = 72;
const SANS = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';
/** More trades than this and their marks would hide the line they sit on. */
const MAX_MARKED_TRADES = 60;

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** `text`, cut with an ellipsis when it is wider than `width` in the current font. */
function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = [...text];
  while (cut.length > 1 && ctx.measureText(`${cut.join("")}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.join("")}…`;
}

function write(ctx, text, x, y, { font, color, align = "left" }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

/** The price line of the round with where the player got in and out. */
function drawChart(ctx, card, x, y, w, h) {
  const { colors, series, trades } = card;
  rounded(ctx, x, y, w, h, 18);
  ctx.fillStyle = colors.panel;
  ctx.fill();
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  write(ctx, `${card.pair} · 这一局的走势`, x + 24, y + 44, { font: `26px ${SANS}`, color: colors.muted });
  if (series.length < 2) return;

  const inner = { x: x + 28, y: y + 76, w: w - 56, h: h - 108 };
  const low = Math.min(...series.map((point) => point.c), ...trades.flatMap((trade) => [trade.open, trade.close]));
  const high = Math.max(...series.map((point) => point.c), ...trades.flatMap((trade) => [trade.open, trade.close]));
  const span = high - low || 1;
  const px = (index) => inner.x + (index / (series.length - 1)) * inner.w;
  const py = (price) => inner.y + (1 - (price - low) / span) * inner.h;

  ctx.beginPath();
  series.forEach((point, index) => (index ? ctx.lineTo(px(index), py(point.c)) : ctx.moveTo(px(index), py(point.c))));
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Bars are placed by their position in the round, so a mark goes to the last bar at or before its time.
  const indexAt = (time) => {
    let lo = 0;
    let hi = series.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (series[mid].t <= time) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const triangle = (cx, cy, up, color) => {
    const s = 13;
    ctx.beginPath();
    ctx.moveTo(cx, cy + (up ? -s : s));
    ctx.lineTo(cx - s, cy + (up ? s : -s));
    ctx.lineTo(cx + s, cy + (up ? s : -s));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = colors.panel;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  if (trades.length <= MAX_MARKED_TRADES) {
    for (const trade of trades) {
      const buy = trade.side === "buy";
      const from = { x: px(indexAt(trade.openTime)), y: py(trade.open) };
      const to = { x: px(indexAt(trade.closeTime)), y: py(trade.close) };
      const color = (buy ? colors.up : colors.down);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      triangle(from.x, from.y, buy, color);
      ctx.beginPath();
      ctx.arc(to.x, to.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = colors.panel;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    write(ctx, "▲ 买入  ▼ 卖出  ○ 平仓", x + w - 24, y + 44, { font: `24px ${SANS}`, color: colors.muted, align: "right" });
  }
}

function drawQr(ctx, modules, x, y, size) {
  rounded(ctx, x, y, size, size, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // Four modules of white on every side, as the standard asks.
  const count = modules.length + 8;
  const at = (index) => Math.round(((index + 4) / count) * size);
  ctx.fillStyle = "#000000";
  modules.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) ctx.fillRect(x + at(c), y + at(r), at(c + 1) - at(c), at(r + 1) - at(r));
  }));
}

function drawUser(ctx, card) {
  const { colors, user } = card;
  if (!user) return;
  const radius = 40;
  const cx = W - PAD - radius;
  const cy = 108;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = colors.line;
  ctx.fill();
  if (user.image) {
    ctx.clip();
    ctx.drawImage(user.image, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    // No picture to show: the first character of the name stands in.
    ctx.font = `600 40px ${SANS}`;
    ctx.fillStyle = colors.fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText([...user.nickname][0], cx, cy + 2);
  }
  ctx.restore();
  ctx.font = `32px ${SANS}`;
  write(ctx, fit(ctx, user.nickname, 360), cx - radius - 20, cy + 11, { font: `32px ${SANS}`, color: colors.fg, align: "right" });
}

/**
 * Draws the card on `canvas`. `card`: `{ title, date, pair, length, returnText,
 * tone, equityText, stats: [[label, value]], series: [{ t, c }], trades,
 * rank, user: { nickname, image } | null, qr: boolean[][], colors }`.
 */
export function drawShareCard(canvas, card) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const { colors } = card;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  write(ctx, "hebi8", PAD, 126, { font: `700 56px ${MONO}`, color: colors.accent });
  const brand = ctx.measureText("hebi8").width;
  write(ctx, "外汇回放", PAD + brand + 22, 124, { font: `600 46px ${SANS}`, color: colors.fg });
  drawUser(ctx, card);
  ctx.fillStyle = colors.line;
  ctx.fillRect(PAD, 176, W - PAD * 2, 2);

  ctx.font = `700 62px ${SANS}`;
  write(ctx, fit(ctx, card.title, W - PAD * 2), PAD, 268, { font: `700 62px ${SANS}`, color: colors.fg });
  write(ctx, `${card.date} · ${card.pair} · 回放 ${card.length}`, PAD, 326, { font: `32px ${SANS}`, color: colors.muted });

  write(ctx, card.returnText, PAD - 6, 500, { font: `700 172px ${MONO}`, color: colors[card.tone] ?? colors.fg });
  write(ctx, `最终净值 ${card.equityText} 日元`, PAD, 566, { font: `36px ${SANS}`, color: colors.fg });
  if (card.rank) write(ctx, `排行榜第 ${card.rank} 名`, W - PAD, 566, { font: `600 36px ${SANS}`, color: colors.accent, align: "right" });

  const gap = 24;
  const box = (W - PAD * 2 - gap * (card.stats.length - 1)) / card.stats.length;
  card.stats.forEach(([label, value], index) => {
    const x = PAD + index * (box + gap);
    rounded(ctx, x, 612, box, 132, 16);
    ctx.fillStyle = colors.panel;
    ctx.fill();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    write(ctx, label, x + 24, 660, { font: `26px ${SANS}`, color: colors.muted });
    write(ctx, value, x + 24, 716, { font: `600 44px ${MONO}`, color: colors.fg });
  });

  drawChart(ctx, card, PAD, 776, W - PAD * 2, 292);

  const qr = 264;
  drawQr(ctx, card.qr, PAD, 1096, qr);
  const tx = PAD + qr + 44;
  write(ctx, "扫码挑战同一段行情", tx, 1192, { font: `700 48px ${SANS}`, color: colors.fg });
  write(ctx, "同一个场景，同一个品种，", tx, 1254, { font: `30px ${SANS}`, color: colors.muted });
  write(ctx, "看谁的收益高。", tx, 1298, { font: `30px ${SANS}`, color: colors.muted });

  write(ctx, "模拟游戏，历史数据回放，不构成投资建议。", W / 2, H - 30, { font: `24px ${SANS}`, color: colors.muted, align: "center" });
}

/**
 * Draws the card and returns it as a PNG data URL. A picture from another
 * site that came without permission to be read back would make the canvas
 * refuse to export; then the card is drawn again without it. The export
 * never fails because of the avatar.
 */
export function renderShareCard(canvas, card) {
  drawShareCard(canvas, card);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    drawShareCard(canvas, { ...card, user: card.user && { ...card.user, image: null } });
    return canvas.toDataURL("image/png");
  }
}

/** A picture from `url` that may be drawn and still exported, or null: the server has to allow cross-origin use. */
export function loadPicture(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
