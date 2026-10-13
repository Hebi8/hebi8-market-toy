// One representative frame of every scene into out/stills/, and the cover into out/.
//
//   npm run stills           the frames named below
//   npm run stills -- --qa   also every 15th frame at half size into out/qa/, to look the whole video through
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {bundle} from "@remotion/bundler";
import {renderStill, selectComposition} from "@remotion/renderer";

const here = fileURLToPath(new URL("../", import.meta.url));

/** Frames of the whole video (30 per second). */
const STILLS = [
  ["s1-hook", 118],
  ["s2-what", 320],
  ["s3a-order", 480],
  ["s3b-replay", 600],
  ["s3c-intervention", 722],
  ["s3d-liquidation", 800],
  ["s4-result", 1000],
  ["s5-challenge", 1260],
  ["s6-end", 1500],
];

await mkdir(`${here}out/stills`, {recursive: true});
const serveUrl = await bundle({entryPoint: `${here}src/index.ts`, publicDir: `${here}public`});
const pick = (id) => selectComposition({serveUrl, id, inputProps: {}});
const video = await pick("FX-Replay-PV");
const cover = await pick("Cover");

await renderStill({composition: cover, serveUrl, output: `${here}out/hebi8-fx-replay-cover.png`, inputProps: cover.props});
for (const [name, frame] of STILLS) {
  await renderStill({composition: video, serveUrl, frame, output: `${here}out/stills/${name}.png`, inputProps: video.props});
  console.log(`${name}: frame ${frame}`);
}
if (process.argv.includes("--qa")) {
  await mkdir(`${here}out/qa`, {recursive: true});
  for (let frame = 0; frame < video.durationInFrames; frame += 15) {
    await renderStill({composition: video, serveUrl, frame, scale: 0.5, imageFormat: "jpeg", output: `${here}out/qa/${String(frame).padStart(4, "0")}.jpg`, inputProps: video.props});
  }
  console.log(`every 15th frame in out/qa/`);
}
