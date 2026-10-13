import type {CalculateMetadataFunction} from "remotion";
import {Composition, Folder, Still} from "remotion";
import {FxReplayPv} from "./FxReplayPv";
import "./index.css";
import type {Manifest, PvProps} from "./project";
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH, capture, sceneDurations} from "./project";
import {Cover} from "./scenes/Cover";
import {Scene1Hook} from "./scenes/Scene1Hook";
import {Scene2What} from "./scenes/Scene2What";
import {Scene3Play} from "./scenes/Scene3Play";
import {Scene4Result} from "./scenes/Scene4Result";
import {Scene5Challenge} from "./scenes/Scene5Challenge";
import {Scene6End} from "./scenes/Scene6End";

const total = Object.values(sceneDurations).reduce((sum, frames) => sum + frames, 0);
if (total !== TOTAL_FRAMES) {
  throw new Error(`Scene durations total ${total}, expected ${TOTAL_FRAMES}`);
}

/** The recording tells the scenes where things are and when they happen; it is read once, before rendering. */
const withRecording: CalculateMetadataFunction<PvProps> = async ({props}) => {
  const response = await fetch(capture("manifest.json"));
  if (!response.ok) {
    throw new Error("public/captures/manifest.json is missing: run `npm run capture` first");
  }

  return {props: {...props, manifest: (await response.json()) as Manifest}};
};

const size = {fps: FPS, height: HEIGHT, width: WIDTH};
const empty: PvProps = {manifest: null};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="FX-Replay-PV" component={FxReplayPv} durationInFrames={TOTAL_FRAMES} {...size} defaultProps={empty} calculateMetadata={withRecording} />
      <Still id="Cover" component={Cover} height={HEIGHT} width={WIDTH} defaultProps={empty} calculateMetadata={withRecording} />

      <Folder name="PV-Scenes">
        <Composition id="S1-Hook" component={Scene1Hook} durationInFrames={sceneDurations.s1} {...size} />
        <Composition id="S2-What" component={Scene2What} durationInFrames={sceneDurations.s2} {...size} defaultProps={empty} calculateMetadata={withRecording} />
        <Composition id="S3-Play" component={Scene3Play} durationInFrames={sceneDurations.s3} {...size} defaultProps={empty} calculateMetadata={withRecording} />
        <Composition id="S4-Result" component={Scene4Result} durationInFrames={sceneDurations.s4} {...size} defaultProps={empty} calculateMetadata={withRecording} />
        <Composition id="S5-Challenge" component={Scene5Challenge} durationInFrames={sceneDurations.s5} {...size} defaultProps={empty} calculateMetadata={withRecording} />
        <Composition id="S6-End" component={Scene6End} durationInFrames={sceneDurations.s6} {...size} defaultProps={empty} calculateMetadata={withRecording} />
      </Folder>
    </>
  );
};
