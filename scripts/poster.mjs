// Makes assets/poster.png (1200×900, the cover uploaded with the Toy): a
// screenshot of a round in progress under the title, and assets/icon.png
// (512×512). Needs the preview server.
//
//   node scripts/poster.mjs [page url]
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { withChrome } from "./chrome.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:8818/toy/hebi8-fx-preview/index.html";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(`${root}output`, { recursive: true });
await mkdir(`${root}assets`, { recursive: true });

const problems = await withChrome([new URL(base).origin, "file://"], async ({ open }) => {
  // 2022-09-22: sell five minutes before the intervention, stop half an hour after it.
  // A step runs to the last minute of the bar that is forming, hence :59 and :34.
  const game = await open({ width: 1088, height: 612, scale: 2 });
  await game.goto(base);
  await game.evaluate(`localStorage.clear()`);
  await game.goto(base);
  await game.until(`document.querySelectorAll(".scenario").length > 0`, "the scenario list");
  await game.click(`.scenario[data-id="2022-09-22-intervention"]`);
  await game.until(`document.querySelector("#chart canvas") && document.getElementById("q-bid").textContent.length > 0`, "the chart");
  const stepUntil = (time) => game.evaluate(`(() => {
    for (let i = 0; i < 200 && !document.getElementById("g-clock").textContent.includes(${JSON.stringify(time)}); i++) document.getElementById("btn-step").click();
    return document.getElementById("g-clock").textContent;
  })()`);
  await stepUntil("15:59");
  await game.evaluate(`(() => { const input = document.getElementById("lots-input"); input.value = "5"; input.dispatchEvent(new Event("change")); })()`);
  await game.click("#btn-sell");
  await stepUntil("16:34");
  await game.shot(`${root}output/poster-shot.png`);
  await game.close();

  const poster = await open({ width: 1200, height: 900, scale: 1 });
  await poster.goto(pathToFileURL(`${root}scripts/poster.html`).href);
  await poster.until(`document.images[0].complete && document.images[0].naturalWidth > 0`, "the screenshot in the poster");
  await poster.shot(`${root}assets/poster.png`);
  await poster.close();

  // The icon is the favicon at the size the upload form asks for.
  const icon = await open({ width: 512, height: 512, scale: 1 });
  await icon.goto(pathToFileURL(`${root}scripts/icon.html`).href);
  await icon.until(`document.images[0].complete && document.images[0].naturalWidth > 0`, "the icon");
  await icon.shot(`${root}assets/icon.png`);
  await icon.close();
});
if (problems.length) {
  console.error(`The page reported:\n${[...new Set(problems)].join("\n")}`);
  process.exit(1);
}
console.log("Wrote assets/poster.png and assets/icon.png");
