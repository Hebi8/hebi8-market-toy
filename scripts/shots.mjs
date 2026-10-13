// Plays one full round in headless Chrome at the three sizes the Toy has to
// work in and saves a screenshot of every step under output/shots/. Along the
// way it checks that a new round starts playing by itself at 1×, that a
// continued one waits, and that the other colour scheme reaches the chart.
// The two phone sizes come in through a challenge link: they have to see the
// challenge card, the friend's result on the result page, and a share picture
// that can be saved. The pictures go to output/share/.
// Needs the preview server (`npm run dev`, or `npm run dev -- --dist`).
//
//   node scripts/shots.mjs [page url]
//
// Exits non-zero when the page logs an error, asks anything of another host,
// or a step does not get where it should.
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { sleep, withChrome } from "./chrome.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:8818/toy/hebi8-fx-preview/index.html";
const out = fileURLToPath(new URL("../output/shots/", import.meta.url));
const SIZES = [
  { name: "desktop", width: 1280, height: 720, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "half", width: 360, height: 400, mobile: true },
];
const SCENARIO = "2022-09-22-intervention";
/** A friend's +3.21% on that round, the way a challenge link carries it. */
const CHALLENGE = `?s=${SCENARIO}&p=USDJPY&r=10321`;
const shareDir = fileURLToPath(new URL("../output/share/", import.meta.url));

// Another origin with a picture and no CORS headers, as an avatar host might be.
const foreign = http.createServer(async (request, response) => {
  response.writeHead(200, { "content-type": "image/png" });
  response.end(await readFile(new URL("../assets/icon.png", import.meta.url)));
});
await new Promise((resolve) => foreign.listen(0, "127.0.0.1", resolve));

/** The card module with the QR encoder and the bar codec, as a script that defines `ShareCard`. */
async function cardModule() {
  const result = await build({
    stdin: {
      contents: 'export * from "./src/share-card.js"; export { encode } from "uqr"; export { decodeBars, fromBase64 } from "./src/engine/codec.js";',
      resolveDir: fileURLToPath(new URL("../", import.meta.url)),
    },
    bundle: true, format: "iife", globalName: "ShareCard", write: false, logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

/** Runs in the page: draws the card three ways and says what happened. */
const cardCheck = async (foreignPicture) => {
  const { renderShareCard, loadPicture, encode, decodeBars, fromBase64 } = ShareCard;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const file = await (await fetch("./data/2022-09-22-intervention.USDJPY.json")).json();
  const played = decodeBars(fromBase64(file.bars), file.scale).slice(file.context);
  const card = {
    title: "24 年来首次买入日元", date: "2022-09-22", pair: "USD/JPY", length: "10 小时",
    returnText: "+18.43%", tone: "up", equityText: "1,184,300",
    stats: [["最大回撤", "0.31%"], ["交易次数", "1 笔"], ["盈利笔数", "1 笔"]],
    series: played.map((bar) => ({ t: bar.t, c: bar.c })),
    trades: [{ side: "sell", open: played[299].c, openTime: played[299].t, close: played[334].c, closeTime: played[334].t }],
    rank: 7,
    user: { nickname: "名字特别特别特别特别特别特别长的一位玩家", image: null },
    qr: encode("https://www.bilibili.com/toy/hebi8-fx-replay/index.html?s=2022-09-22-intervention&p=USDJPY&r=11843", { ecc: "M", border: 0 }).data,
    colors: { bg: css("--bg"), panel: css("--panel"), line: css("--line"), fg: css("--fg"), muted: css("--muted"), accent: css("--accent"), up: css("--up"), down: css("--down"), flat: css("--fg") },
  };
  const canvas = document.createElement("canvas");
  const plain = renderShareCard(canvas, card);
  // Asked for properly, a picture without permission does not load at all.
  const refused = await loadPicture(foreignPicture);
  // Drawn regardless, it spoils the canvas: the card must fall back to the initial.
  const spoiling = await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = foreignPicture;
  });
  const afterSpoiling = renderShareCard(canvas, { ...card, user: { ...card.user, image: spoiling } });
  const own = await loadPicture(new URL("./favicon.svg", location.href).href);
  const withPicture = renderShareCard(canvas, { ...card, user: { nickname: "dreaife", image: own } });
  const png = (text) => typeof text === "string" && text.startsWith("data:image/png;base64,") && text.length > 50_000;
  return {
    plainExports: png(plain),
    pictureWithoutPermissionIsRefused: refused === null,
    spoiledCanvasStillExports: Boolean(spoiling) && png(afterSpoiling) && afterSpoiling === plain,
    allowedPictureIsDrawn: Boolean(own) && png(withPicture) && withPicture !== plain,
    pictures: { "card-name-rank": plain, "card-picture": withPicture },
  };
};

await mkdir(out, { recursive: true });
await rm(shareDir, { recursive: true, force: true });
await mkdir(shareDir, { recursive: true });
let saved = 0;
let failure = null;
const problems = await withChrome([new URL(base).origin, `http://127.0.0.1:${foreign.address().port}`], async ({ open, browser }) => {
  // "保存图片" outside the app is a download; let it land where it can be looked at.
  await browser("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: shareDir });
  for (const size of SIZES) {
    const challenged = size.mobile;
    const page = await open(size);
    const { click, evaluate, until } = page;
    const shot = (step) => {
      saved++;
      return page.shot(`${out}${size.name}-${step}.png`);
    };
    try {
      await page.goto(base);
      await evaluate(`localStorage.clear()`);
      await page.goto(challenged ? base + CHALLENGE : base);
      await until(`document.querySelectorAll(".scenario").length > 0`, "the scenario list");
      if (challenged) {
        await until(`!document.getElementById("challenge").hidden`, "the challenge card");
        const invitation = await evaluate(`document.getElementById("c-text").textContent`);
        if (!invitation.includes("24 年来首次买入日元 · USD/JPY") || !invitation.includes("+3.21%")) throw new Error(`the challenge card says "${invitation}"`);
      } else if (!(await evaluate(`document.getElementById("challenge").hidden`))) throw new Error("a challenge card without a challenge link");
      await shot("1-home");
      if (size.name === "phone") {
        // Declining leaves the list as it always is.
        await click("#challenge [data-close]");
        await click("#btn-rules");
        await shot("1-rules");
        await click("#rules [data-close]");
        await click("#btn-rank");
        await until(`document.querySelector("#rank-body .rank-note")`, "the local leaderboard");
        await click("#rank [data-close]");
      }

      if (size.name === "phone") {
        // Back to the link to take the challenge up after all.
        await page.goto(base + CHALLENGE);
        await until(`!document.getElementById("challenge").hidden`, "the challenge card again");
      }
      await click(challenged ? "#c-start" : `.scenario[data-id="${SCENARIO}"]`);
      await until(`!document.getElementById("game").hidden && document.querySelector("#chart canvas")`, "the chart");
      await until(`document.getElementById("q-bid").textContent.length > 0`, "a quote");
      // A new round runs from the first moment, at 1×.
      const playing = `document.getElementById("btn-play").getAttribute("aria-label") === "暂停"`;
      const clock = `document.getElementById("g-clock").textContent`;
      if (!(await evaluate(playing)) || await evaluate(`document.getElementById("btn-speed").textContent`) !== "1×") throw new Error("the round did not start playing at 1×");
      const opened = await evaluate(clock);
      await until(`${clock} !== ${JSON.stringify(opened)}`, "the replay to move on its own", 5000);
      await click("#btn-play");
      await shot("2-start");

      // An order worth five times the account, with a stop-loss and a take-profit.
      await click(`#lot-chips [data-leverage="5"]`);
      await evaluate(`(() => {
        const set = (id, value) => { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event("change")); };
        set("sl-input", "60"); set("tp-input", "150");
      })()`);
      const weight = await evaluate(`document.getElementById("ticket-hint").textContent`);
      if (!/这一单 ≈ 本金的 [45]\.\d 倍/.test(weight)) throw new Error(`the 5× choice gives "${weight}"`);
      await click("#btn-buy");
      await until(`document.getElementById("n-open").textContent === "1"`, "the long position");
      if (size.name === "desktop") {
        // Leaving a round keeps it: the list offers to continue it, position and all.
        await click("#btn-back");
        await until(`!document.getElementById("resume").hidden`, "the offer to continue");
        await shot("2-resume");
        await click("#resume");
        await until(`!document.getElementById("game").hidden && document.getElementById("n-open").textContent === "1"`, "the resumed round");
        // ...and waits for the player instead of running off.
        const resumed = await evaluate(clock);
        await sleep(1500);
        if (await evaluate(playing) || await evaluate(clock) !== resumed) throw new Error("a continued round must stay paused");
      }
      if (size.name === "half") {
        await click("#btn-sheet");
        await shot("3-sheet");
        await click("#btn-sheet");
      }
      await click("#btn-step");
      while (await evaluate(`document.getElementById("btn-speed").textContent`) !== "30×") await click("#btn-speed");
      await click("#btn-play");
      await sleep(4500);
      await click("#btn-play");
      await shot("3-running");

      // A short without levels, closed by hand a little later.
      await evaluate(`document.getElementById("sl-input").value = ""; document.getElementById("tp-input").value = ""`);
      await click("#btn-sell");
      await until(`document.querySelectorAll("#open-rows [data-close-id]").length === 2`, "the short position");
      await click("#tf-seg button[data-value='1']");
      await click("#btn-play");
      await sleep(3000);
      await click("#btn-play");
      await shot("4-short");
      const before = Number(await evaluate(`document.getElementById("n-closed").textContent`));
      await evaluate(`[...document.querySelectorAll("#open-rows [data-close-id]")].pop().click()`);
      await until(`Number(document.getElementById("n-closed").textContent) === ${before + 1}`, "the manual close");
      await click("#tf-seg button[data-value='15']");

      await click("#btn-play");
      await until(`!document.getElementById("result").hidden`, "the result", 60_000);
      await shot("5-result");
      const line = await evaluate(`[document.getElementById("r-heading").textContent, document.getElementById("r-return").textContent,
        document.getElementById("r-equity").textContent, document.querySelector("#r-stats div:nth-child(2) b").textContent].join(" / ")`);
      console.log(`${size.name} ${size.width}×${size.height}: ${line}`);

      // The friend's result is on the result page exactly when the round came from a challenge link.
      const rows = await evaluate(`[...document.querySelectorAll("#r-compare td:first-child")].map((cell) => cell.textContent).join("|")`);
      const verdict = await evaluate(`document.getElementById("r-verdict").hidden ? "" : document.getElementById("r-verdict").textContent`);
      if (rows.includes("朋友的成绩") !== challenged || Boolean(verdict) !== challenged) throw new Error(`friend's result: rows "${rows}", verdict "${verdict}"`);
      if (challenged) console.log(`  ${verdict}`);

      // The share picture: there at once, exportable, and saved as a file by the button.
      await click("#r-share");
      await until(`document.getElementById("share-img").src.startsWith("data:image/png;base64,") && document.getElementById("share-img").naturalWidth === 1080`, "the share picture");
      await shot("5-share");
      const picture = await evaluate(`document.getElementById("share-img").src`);
      await writeFile(`${shareDir}card-${size.name}.png`, Buffer.from(picture.slice(picture.indexOf(",") + 1), "base64"));
      // On the desktop a real click, which is allowed to copy; on the phones a scripted one, which is not
      // and has to end with the text on screen, selected.
      await (challenged ? click : page.press)("#share-copy");
      await until(`document.getElementById("share-status").textContent.length > 0`, "an answer to copying the link");
      const copied = await evaluate(`document.getElementById("share-status").textContent + (document.getElementById("share-text").hidden ? "" : " [" + document.getElementById("share-text").value + "]")`);
      console.log(`  copy: ${copied}`);
      await shot("5-share-copied");
      const download = `hebi8-fx-${SCENARIO}-USDJPY.png`;
      await click("#share-save");
      const deadline = Date.now() + 10_000;
      while (!(await readdir(shareDir)).includes(download)) {
        if (Date.now() > deadline) throw new Error("保存图片 did not produce a file");
        await sleep(200);
      }
      await rename(`${shareDir}${download}`, `${shareDir}saved-${size.name}.png`);
      await click("#share [data-close]");
      await click("#r-look");
      await shot("6-after");
      await click("#btn-back");
      await until(`!document.getElementById("home").hidden`, "the scenario list again");
      await shot("7-home-best");

      if (size.name === "desktop") {
        // The other colour scheme: list, buttons, candles and level lines follow.
        const label = await evaluate(`document.getElementById("palette-label").textContent`);
        await click("#btn-palette");
        await until(`document.getElementById("palette-label").textContent !== ${JSON.stringify(label)}`, "the colour scheme to switch");
        await click(`.scenario[data-id="2024-08-05-carry-unwind"]`);
        await until(`!document.getElementById("game").hidden && ${playing}`, "the second round");
        await click("#btn-play");
        await click(`#lot-chips [data-leverage="10"]`);
        await click("#btn-sell");
        await click("#tf-seg button[data-value='5']");
        for (let i = 0; i < 40; i++) await click("#btn-step");
        await shot("8-red-up");
        await click("#btn-back");
        await page.goto(base);
        await until(`document.querySelectorAll(".scenario").length > 0`, "the list after a reload");
        if (await evaluate(`document.getElementById("palette-label").textContent`) === label) throw new Error("the colour scheme was not remembered");
      }
    } catch (error) {
      failure = `${size.name}: ${error.message}`;
      break;
    } finally {
      await page.close();
    }
  }
  // What a local run never gets from the platform: a name, a rank and an
  // avatar. The card is drawn here with all three, and with an avatar from
  // another origin that may not be read back: the export has to come out anyway.
  if (!failure) {
    const page = await open({ width: 1280, height: 720 });
    try {
      await page.goto(base);
      await page.until(`document.querySelectorAll(".scenario").length > 0`, "the page for the card check");
      await page.evaluate(await cardModule());
      const report = await page.evaluate(`(${cardCheck})(${JSON.stringify(`http://127.0.0.1:${foreign.address().port}/avatar.png`)})`);
      for (const [name, picture] of Object.entries(report.pictures)) {
        await writeFile(`${shareDir}${name}.png`, Buffer.from(picture.slice(picture.indexOf(",") + 1), "base64"));
      }
      delete report.pictures;
      console.log(`card check: ${JSON.stringify(report)}`);
      if (!Object.values(report).every(Boolean)) failure = `card check: ${JSON.stringify(report)}`;
    } catch (error) {
      failure = `card check: ${error.message}`;
    } finally {
      await page.close();
    }
  }
});

const foreignPort = foreign.address().port;
foreign.close();
console.log(`${saved} screenshots in ${out}, share pictures in ${shareDir}`);
if (failure) console.error(failure);
// The card check asks for a picture it must not get; the browser saying so is the point, not a problem.
const unexpected = [...new Set(problems)].filter((problem) => !problem.includes(`:${foreignPort}/`));
if (unexpected.length) console.error(`The page reported:\n${unexpected.join("\n")}`);
process.exit(failure || unexpected.length ? 1 : 0);
