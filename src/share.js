// The share panel behind "分享战绩": a picture of the round with the QR code
// of its challenge link, and three ways to get it to a friend. The picture
// is there at once; the leaderboard rank and the player's name are added if
// and when they arrive. Nothing that fails on the way stops saving or copying.
import { encode } from "uqr";
import { challengePath, challengeUrl } from "./engine/challenge.js";
import { duration, pairName, percent, tone, yen } from "./format.js";
import { loadPicture, renderShareCard } from "./share-card.js";
import { cssColor, palette } from "./theme.js";
import { canShare, myRank, saveToAlbum, shareToy, userProfile } from "./toy.js";

const $ = (id) => document.getElementById(id);
const canvas = document.createElement("canvas");
/** What the buttons act on; replaced every time the panel is opened. */
let shared = null;

const status = (message) => {
  $("share-status").textContent = message;
};

/**
 * Opens the panel for a finished round. `withRank`: whether there is a
 * leaderboard to ask. The player's profile is asked for here and not before:
 * the platform shows a consent dialog the first time.
 */
export function openShare({ scenario, pair, outcome, played, trades, withRank }) {
  const round = { scenarioId: scenario.id, pair, returnPct: outcome.returnPct };
  const url = challengeUrl(round);
  const card = {
    title: scenario.title,
    date: scenario.date,
    pair: pairName(pair),
    length: duration(played.length * 60),
    returnText: percent(outcome.returnPct),
    tone: tone(outcome.returnPct),
    equityText: yen(outcome.equity),
    stats: [
      ["最大回撤", `${outcome.maxDrawdownPct.toFixed(2)}%`],
      ["交易次数", `${outcome.trades} 笔`],
      ["盈利笔数", `${outcome.wins} 笔`],
    ],
    series: played.map((bar) => ({ t: bar.t, c: bar.c })),
    trades,
    rank: null,
    user: null,
    qr: encode(url, { ecc: "M", border: 0 }).data,
    colors: {
      bg: cssColor("--bg"), panel: cssColor("--panel"), line: cssColor("--line"), fg: cssColor("--fg"),
      muted: cssColor("--muted"), accent: cssColor("--accent"), up: palette().up.line, down: palette().down.line, flat: cssColor("--fg"),
    },
  };
  const current = {
    message: `我在 hebi8 外汇回放的〈${scenario.title} · ${pairName(pair)}〉拿到 ${percent(outcome.returnPct)}，来挑战：${url}`,
    path: challengePath(round),
    fileName: `hebi8-fx-${scenario.id}-${pair}.png`,
    dataUrl: "",
  };
  shared = current;
  // A later answer belongs on the picture only while this round's panel is the one in use.
  const repaint = () => {
    if (shared !== current) return;
    current.dataUrl = renderShareCard(canvas, card);
    $("share-img").src = current.dataUrl;
  };

  repaint();
  status("");
  $("share-text").hidden = true;
  $("share-native").hidden = true;
  $("share").hidden = false;

  canShare().then((available) => {
    if (shared === current) $("share-native").hidden = !available;
  });
  if (withRank) {
    myRank().then((mine) => {
      if (!mine) return;
      card.rank = mine.rank;
      repaint();
    });
  }
  userProfile().then(async (user) => {
    if (!user) return;
    card.user = { nickname: user.nickname, image: null };
    repaint();
    const image = user.avatar && await loadPicture(user.avatar);
    if (!image) return;
    card.user = { nickname: user.nickname, image };
    repaint();
  });
}

async function save() {
  const current = shared;
  if (await saveToAlbum(current.dataUrl)) {
    status("已保存到相册。");
    return;
  }
  // Outside the app: hand the file to the browser. The picture stays on screen for a long-press either way.
  canvas.toBlob((blob) => {
    if (!blob) {
      status("这里存不了文件：长按上面的图片保存。");
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = current.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
    status("图片已交给浏览器下载。没有反应的话，长按上面的图片保存。");
  }, "image/png");
}

async function copy() {
  const { message } = shared;
  try {
    await navigator.clipboard.writeText(message);
    status("已复制，去粘贴给朋友吧。");
    return;
  } catch {
    // An embedded frame is usually refused; try the old way.
  }
  const box = $("share-text");
  box.hidden = false;
  box.value = message;
  box.focus();
  box.setSelectionRange(0, message.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  if (copied) {
    box.hidden = true;
    status("已复制，去粘贴给朋友吧。");
  } else {
    // Left on screen and selected: the player can copy it by hand.
    status("这里不能自动复制：文字已经选中，请手动复制。");
  }
}

async function shareNative() {
  if (!(await shareToy(shared.path))) status("没能打开分享，试试保存图片或复制链接。");
}

$("share-save").onclick = save;
$("share-copy").onclick = copy;
$("share-native").onclick = shareNative;
