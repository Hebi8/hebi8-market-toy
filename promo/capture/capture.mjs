// Plays the round the promo video shows, in headless Chrome against the built
// package, and records it into public/captures/: the scenario list, every frame
// of the round from its first bar to the result page, the result, the share
// picture, and the challenge card that the round's own link opens.
//
//   npm run build        (in the repository root: the page that is recorded is dist/toy/)
//   npm run capture      (here)
//
// The round is played by the game itself: its replay loop, its speed button, its
// engine. Only the clock is ours. The loop runs on requestAnimationFrame and
// performance.now(); the recording replaces both (and setTimeout, for the life of
// the toasts) with a clock that moves when the script says so, one video frame at
// a time, and takes a screenshot after every move. So every frame is at a known
// instant of the replay however long the screenshot took. Nothing in src/ knows.
//
// The preview server is started here on its own port and stopped by its PID.
import { spawn } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sleep, withChrome } from "./chrome.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = fileURLToPath(new URL("../public/captures/", import.meta.url));
const port = Number(process.env.PORT ?? 8831);
const base = `http://127.0.0.1:${port}/toy/hebi8-fx-preview/index.html`;

/** The round that is played. */
const PLAN = {
  scenario: "2022-09-22-intervention",
  /** The quick choice that is clicked, then how many times "+" (one lot each). */
  chip: "10",
  plus: 7,
  side: "buy",
  /** The quick choice clicked once the order is in. */
  after: "1",
  /** From this time on the clock every frame is half as long, so the edit can slow it down. */
  closeUpFrom: "09-22 15:58",
};
const FPS = 30;
/** The frame of the round: the desktop layout with as few CSS pixels as it allows, so the text is large. */
const STAGE = { width: 1024, height: 576, scale: 2.5 };

const CLOCK = `(() => {
  let now = 0;
  let nextId = 1;
  const frames = new Map();
  const timers = new Map();
  performance.now = () => now;
  window.requestAnimationFrame = (callback) => { const id = nextId++; frames.set(id, callback); return id; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };
  window.setTimeout = (callback, delay = 0, ...args) => { const id = nextId++; timers.set(id, { at: now + Number(delay || 0), callback, args }); return id; };
  window.clearTimeout = (id) => { timers.delete(id); };
  // What one frame asks for (a redraw, say) is done before the screenshot: later passes run at the same instant.
  window.__advance = (ms) => {
    now += ms;
    for (let pass = 0; pass < 3; pass++) {
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(...timer.args); }
      const due = [...frames.values()];
      frames.clear();
      for (const callback of due) callback(now);
    }
  };
})();`;

/** What the page says about the round at this instant. */
const STATE = `(() => {
  const read = (id) => document.getElementById(id).textContent;
  const cell = (id) => { const box = document.getElementById(id).parentElement.getBoundingClientRect(); return [box.left, box.top, box.width, box.height]; };
  return {
    clock: read("g-clock").slice(0, 11),
    speed: read("btn-speed"),
    open: Number(read("n-open")),
    over: !document.getElementById("result").hidden,
    cells: [cell("a-equity"), cell("a-floating"), cell("a-leverage")],
  };
})()`;

await rm(out, { recursive: true, force: true });
await mkdir(`${out}play`, { recursive: true });

const server = spawn(process.execPath, ["scripts/preview.mjs", "--dist"], {
  cwd: root, env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((resolve, reject) => {
  let log = "";
  const hear = (chunk) => {
    log += chunk;
    if (log.includes("The page alone")) resolve();
  };
  server.stdout.on("data", hear);
  server.stderr.on("data", hear);
  server.on("exit", () => reject(new Error(`the preview server did not start on port ${port}:\n${log}`)));
});

const manifest = { fps: FPS, stage: STAGE, plan: PLAN, frames: [], marks: {}, rects: {} };
let failure = null;
let problems = [];
try {
  problems = await withChrome([`http://127.0.0.1:${port}`], async ({ open }) => {
    // ---- the scenario list, before anything was played ----
    const home = await open({ width: 1280, height: 720, scale: 2 });
    await home.goto(base);
    await home.evaluate(`localStorage.clear()`);
    await home.goto(base);
    await home.until(`document.querySelectorAll(".scenario").length > 0`, "the scenario list");
    manifest.scenarios = await home.evaluate(`document.querySelectorAll(".scenario").length`);
    manifest.pairs = await home.evaluate(`[...document.querySelectorAll("#pair-seg button")].map((button) => button.textContent)`);
    manifest.rects.rank = await home.rect("#btn-rank");
    await sleep(400);
    await home.shot(`${out}home.png`);
    // The way to the leaderboard, close enough to read: the two buttons in the corner of the list.
    const rules = await home.rect("#btn-rules");
    const corner = { x: manifest.rects.rank.x - 14, y: manifest.rects.rank.y - 12, width: rules.x + rules.width - manifest.rects.rank.x + 28, height: manifest.rects.rank.height + 24 };
    manifest.rects.corner = corner;
    await home.shot(`${out}rank.png`, corner, 3);
    await home.close();

    // ---- the round ----
    const page = await open({ ...STAGE, preload: CLOCK });
    const { click, evaluate } = page;
    /** Waits without letting the replay move: time stands still, what is due runs. */
    const until = async (expression, what) => {
      const deadline = Date.now() + 15_000;
      while (!(await evaluate(`(__advance(0), ${expression})`))) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await sleep(50);
      }
    };
    let time = 0;
    /** One frame: move the clock, look, take the picture. */
    const frame = async (ms = 1000 / FPS) => {
      const state = await evaluate(`(__advance(${ms}), ${STATE})`);
      time += ms;
      const file = `play/${String(manifest.frames.length).padStart(4, "0")}.png`;
      await page.shot(out + file);
      manifest.frames.push({ file, t: Math.round(time * 100) / 100, ...state });
      return state;
    };
    const run = async (count) => {
      for (let i = 0; i < count; i++) await frame();
    };
    const mark = (name) => {
      manifest.marks[name] = manifest.frames.length;
    };

    await page.goto(base);
    await until(`document.querySelectorAll(".scenario").length > 0`, "the scenario list");
    await click(`.scenario[data-id="${PLAN.scenario}"]`);
    await until(`!document.getElementById("game").hidden && document.querySelector("#chart canvas") && document.getElementById("q-bid").textContent.length > 0`, "the chart");
    for (const [name, selector] of [["chart", ".chart-wrap"], ["side", ".side"], ["ticket", "#ticket"], ["account", "#account"], ["top", ".top"]]) {
      manifest.rects[name] = await page.rect(selector);
    }
    manifest.title = await evaluate(`document.getElementById("g-pair").textContent + " · " + document.getElementById("g-title").textContent`);

    for (const [name, selector] of [["buy", "#btn-buy"], ["sell", "#btn-sell"], ["plus", "#lots-plus"], ["lots", ".lots label"], ["hint", "#ticket-hint"], ["speedButton", "#btn-speed"], ["chip", `#lot-chips [data-leverage="${PLAN.chip}"]`]]) {
      manifest.rects[name] = await page.rect(selector);
    }

    // A new round runs by itself at 1×.
    await run(75);
    mark("chip");
    await click(`#lot-chips [data-leverage="${PLAN.chip}"]`);
    await run(8);
    for (let i = 0; i < PLAN.plus; i++) {
      await click("#lots-plus");
      await run(3);
    }
    manifest.order = await evaluate(`document.getElementById("ticket-hint").textContent`);
    await run(12);
    mark("order");
    await click(PLAN.side === "buy" ? "#btn-buy" : "#btn-sell");
    await run(14);
    // Back to a small order in the ticket, as one does: its line then says what is held, not what a second such order would add up to.
    await click(`#lot-chips [data-leverage="${PLAN.after}"]`);
    await run(10);
    mark("speed");
    while (await evaluate(`document.getElementById("btn-speed").textContent`) !== "30×") {
      await click("#btn-speed");
      await run(4);
    }
    mark("fast");
    let state = await frame();
    while (!state.over && state.clock < PLAN.closeUpFrom) state = await frame();
    mark("closeUp");
    // The frames around the intervention are half as long.
    let guard = 0;
    while (!state.over) {
      state = await frame(500 / FPS);
      if (++guard > 3600) throw new Error("the round did not end on the intervention");
    }
    mark("over");
    await run(2);

    manifest.result = await evaluate(`({
      heading: document.getElementById("r-heading").textContent,
      sub: document.getElementById("r-sub").textContent,
      returnText: document.getElementById("r-return").textContent,
      equity: document.getElementById("r-equity").textContent,
    })`);
    if (manifest.result.heading !== "爆仓了") throw new Error(`the round ended with "${manifest.result.heading}", the video tells of a liquidation`);
    manifest.rects.dialog = await page.rect("#result .dialog");
    await page.shot(`${out}result.png`);

    // ---- its share picture and its challenge link ----
    await click("#r-share");
    await until(`document.getElementById("share-img").src.startsWith("data:image/png;base64,") && document.getElementById("share-img").naturalWidth === 1080`, "the share picture");
    await sleep(300);
    manifest.rects.shareDialog = await page.rect("#share .dialog");
    await page.shot(`${out}share-panel.png`);
    const picture = await evaluate(`document.getElementById("share-img").src`);
    await writeFile(`${out}share-card.png`, Buffer.from(picture.slice(picture.indexOf(",") + 1), "base64"));
    // A scripted click may not copy: the text ends up on screen, which is where it is read from.
    await click("#share-copy");
    await until(`document.getElementById("share-status").textContent.length > 0`, "an answer to copying the link");
    const text = await evaluate(`document.getElementById("share-text").value`);
    const link = /https:\/\/\S+/.exec(text)?.[0];
    if (!link) throw new Error(`no challenge link in "${text}"`);
    manifest.challenge = { url: link, text };
    await click("#share [data-close]");
    await click("#r-look");
    await evaluate(`__advance(3000)`);
    await sleep(300);
    await page.shot(`${out}after.png`);
    await page.close();

    // ---- what a friend sees who opens that link ----
    const phone = await open({ width: 390, height: 844, mobile: true, scale: 3 });
    await phone.goto(base + new URL(link).search);
    await phone.until(`!document.getElementById("challenge").hidden`, "the challenge card");
    manifest.challenge.card = await phone.evaluate(`document.getElementById("c-text").textContent`);
    manifest.rects.challenge = await phone.rect("#challenge .dialog");
    await sleep(400);
    await phone.shot(`${out}challenge-phone.png`);
    await phone.close();
  });
} catch (error) {
  failure = error.message;
} finally {
  server.kill();
}

await copyFile(`${root}assets/icon.png`, `${out}icon.png`);
await writeFile(`${out}manifest.json`, JSON.stringify(manifest));

console.log(`${manifest.frames.length} frames of the round, marks ${JSON.stringify(manifest.marks)}`);
console.log(`order: ${manifest.order}`);
console.log(`result: ${JSON.stringify(manifest.result)}`);
console.log(`challenge: ${manifest.challenge?.url}\n  ${manifest.challenge?.card}`);
if (failure) console.error(failure);
if (problems.length) console.error(`The page reported:\n${[...new Set(problems)].join("\n")}`);
process.exit(failure || problems.length ? 1 : 0);
