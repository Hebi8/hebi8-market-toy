// Plays one full round in headless Chrome at the three sizes the Toy has to
// work in and saves a screenshot of every step under output/shots/.
// Needs the preview server (`npm run dev`, or `npm run dev -- --dist`).
//
//   node scripts/shots.mjs [page url]
//
// Exits non-zero when the page logs an error, asks anything of another host,
// or a step does not get where it should.
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sleep, withChrome } from "./chrome.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:8818/toy/hebi8-fx-preview/index.html";
const out = fileURLToPath(new URL("../output/shots/", import.meta.url));
const SIZES = [
  { name: "desktop", width: 1280, height: 720, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "half", width: 360, height: 400, mobile: true },
];
const SCENARIO = "2022-09-22-intervention";

await mkdir(out, { recursive: true });
let saved = 0;
let failure = null;
const problems = await withChrome([new URL(base).origin], async ({ open }) => {
  for (const size of SIZES) {
    const page = await open(size);
    const { click, evaluate, until } = page;
    const shot = (step) => {
      saved++;
      return page.shot(`${out}${size.name}-${step}.png`);
    };
    try {
      await page.goto(base);
      await evaluate(`localStorage.clear()`);
      await page.goto(base);
      await until(`document.querySelectorAll(".scenario").length > 0`, "the scenario list");
      await shot("1-home");
      if (size.name === "phone") {
        await click("#btn-rules");
        await shot("1-rules");
        await click("#rules [data-close]");
        await click("#btn-rank");
        await until(`document.querySelector("#rank-body .rank-note")`, "the local leaderboard");
        await click("#rank [data-close]");
      }

      await click(`.scenario[data-id="${SCENARIO}"]`);
      await until(`!document.getElementById("game").hidden && document.querySelector("#chart canvas")`, "the chart");
      await until(`document.getElementById("q-bid").textContent.length > 0`, "a quote");
      await shot("2-start");

      // Buy 3 lots with a stop-loss and a take-profit, then let it run.
      await evaluate(`(() => {
        const set = (id, value) => { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event("change")); };
        set("lots-input", "3"); set("sl-input", "60"); set("tp-input", "150");
      })()`);
      await click("#btn-buy");
      await until(`document.getElementById("n-open").textContent === "1"`, "the long position");
      if (size.name === "desktop") {
        // Leaving a round keeps it: the list offers to continue it, position and all.
        await click("#btn-back");
        await until(`!document.getElementById("resume").hidden`, "the offer to continue");
        await shot("2-resume");
        await click("#resume");
        await until(`!document.getElementById("game").hidden && document.getElementById("n-open").textContent === "1"`, "the resumed round");
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
      await click("#r-look");
      await shot("6-after");
      await click("#btn-back");
      await until(`!document.getElementById("home").hidden`, "the scenario list again");
      await shot("7-home-best");
    } catch (error) {
      failure = `${size.name}: ${error.message}`;
      break;
    } finally {
      await page.close();
    }
  }
});

console.log(`${saved} screenshots in ${out}`);
if (failure) console.error(failure);
if (problems.length) console.error(`The page reported:\n${[...new Set(problems)].join("\n")}`);
process.exit(failure || problems.length ? 1 : 0);
