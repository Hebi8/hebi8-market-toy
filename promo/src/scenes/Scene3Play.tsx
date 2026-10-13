import {Img, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {Card, Tag} from "../components/Card";
import {Fly} from "../components/Fly";
import {Ring} from "../components/Ring";
import {SceneChrome} from "../components/SceneChrome";
import {Shot} from "../components/Shot";
import {Sticker} from "../components/Sticker";
import {between, leave} from "../motion";
import type {Manifest, PvProps, Rect} from "../project";
import {BLUE, INK, PINK, SCATTER, YELLOW, capture, recorded} from "../project";

/** Where the recording sits on the canvas. */
const STAGE = {left: 50, top: 40, width: 1330};
/** The calm hours between the order and the intervention go by this much faster than they were recorded. */
const HURRY = 2;
/** Around the intervention every recorded frame (half as long as the others) stays this many frames. */
const LINGER = 2;
/** The minute the yen is bought: the first bar of the fall, as the game's clock shows it. */
const INTERVENTION = "09-22 16:03";
/** The account bar's own colour, around the enlarged figures. */
const BAR = "#171c24";

/**
 * Which recorded frame is on screen at each frame of the scene. The recording
 * is one take; the edit only changes how fast it runs.
 */
export const timeline = (manifest: Manifest) => {
  const {marks, frames} = manifest;
  const hurryFrom = marks.fast + 15;
  const closeUpFrom = hurryFrom + Math.round((marks.closeUp - hurryFrom) / HURRY);
  const overFrom = closeUpFrom + Math.round((marks.over - marks.closeUp) * LINGER);
  const at = (frame: number) => {
    const source = frame < hurryFrom ? frame
      : frame < closeUpFrom ? hurryFrom + (frame - hurryFrom) * HURRY
        : frame < overFrom ? marks.closeUp + (frame - closeUpFrom) / LINGER
          : frames.length - 1;
    return Math.max(0, Math.min(frames.length - 1, Math.floor(source)));
  };
  const fall = frames.findIndex((frame) => frame.clock >= INTERVENTION);
  const fallFrom = closeUpFrom + Math.round((fall - marks.closeUp) * LINGER);
  return {at, hurryFrom, closeUpFrom, fallFrom, overFrom};
};

/** One figure of the account bar, cut out of the frame on screen and enlarged. */
const Figure: React.FC<{src: string; cell: [number, number, number, number]; page: number}> = ({src, cell, page}) => {
  const zoom = 3.3;
  const pad = 7;
  const [x, y, width, height] = cell;

  return (
    <div
      style={{
        backgroundColor: BAR,
        border: `5px solid ${INK}`,
        borderRadius: 22,
        boxShadow: "12px 14px 0 rgba(32,37,43,0.14)",
        height: (height + pad * 2) * zoom + 10,
        overflow: "hidden",
        position: "relative",
        width: 428,
      }}
    >
      <div style={{height: "100%", left: 0, overflow: "hidden", position: "absolute", top: 0, width: (width + pad * 2) * zoom}}>
        <Img src={src} style={{left: -(x - pad) * zoom, maxWidth: "none", position: "absolute", top: -(y - pad) * zoom, width: page * zoom}} />
      </div>
    </div>
  );
};

/** How it plays: the recorded round, from the first bar to the liquidation. */
export const Scene3Play: React.FC<PvProps> = (props) => {
  const manifest = recorded(props.manifest);
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const {marks, rects, stage} = manifest;
  const {at, hurryFrom, closeUpFrom, fallFrom, overFrom} = timeline(manifest);
  const shown = manifest.frames[at(frame)];
  const src = capture(shown.file);
  const zoom = STAGE.width / stage.width;
  const middle = (rect: Rect) => ({x: STAGE.left + (rect.x + rect.width / 2) * zoom, y: STAGE.top + (rect.y + rect.height / 2) * zoom});
  const end = durationInFrames - SCATTER;

  // The blow lands: a short shudder of the whole frame.
  const shudder = between(frame, overFrom, overFrom + 14)
    ? Math.sin((frame - overFrom) * 2.4) * interpolate(frame, [overFrom, overFrom + 14], [16, 0])
    : 0;
  const figuresGone = leave(frame, overFrom - 4, 10);

  const faces: [string, number, number][] = [
    ["🙂", 10, marks.chip],
    ["🤔", marks.chip, marks.order + 4],
    ["😎", marks.order + 4, fallFrom + 4],
    ["😨", fallFrom + 4, overFrom],
    ["😱", overFrom, durationInFrames],
  ];

  return (
    <SceneChrome>
      <Fly name="The round, recorded" at={-4} length={22} from={{x: -160, y: -940, rotate: -12}} out={{x: -1500, y: -200, rotate: -14}} style={{left: STAGE.left, top: STAGE.top}}>
        <div style={{translate: `${shudder}px ${shudder * 0.4}px`}}>
          <Shot src={src} width={STAGE.width} ratio={stage.height / stage.width} />
        </div>
      </Fly>

      <Ring at={marks.chip} {...middle(rects.chip)} size={90} />
      <Ring at={marks.chip + 10} {...middle(rects.plus)} size={90} />
      <Ring at={marks.order} {...middle(rects.buy)} size={150} />
      <Ring at={marks.speed + 4} {...middle(rects.speedButton)} size={90} />

      {between(frame, hurryFrom, closeUpFrom) ? (
        <Fly name="Fast-forward note" at={hurryFrom} length={8} from={{scale: 0.6}} outAt={closeUpFrom - 8} outLength={8} out={{scale: 0.6}} rotate={-3} style={{left: 70, top: 150}}>
          <Tag size={36}>⏩ 快进</Tag>
        </Fly>
      ) : null}

      {/* The account bar, large enough to read: the same pixels as in the frame above. */}
      {shown.cells.map((cell, index) => (
        <Fly
          key={index}
          name={["Equity, enlarged", "Floating profit, enlarged", "Effective leverage, enlarged"][index]}
          at={26 + index * 6}
          from={{y: 260, rotate: index === 1 ? 4 : -6}}
          rotate={[-1.5, 1, -1][index]}
          outAt={end}
          out={{y: 420, rotate: 10}}
          style={{left: 50 + index * 452, top: 838}}
        >
          <div style={{opacity: 1 - figuresGone, translate: `0px ${figuresGone * 300}px`}}>
            <Figure src={src} cell={cell} page={stage.width} />
          </div>
        </Fly>
      ))}
      <Fly name="Magnifier sticker" at={44} from={{scale: 0.5, rotate: 30}} rotate={-10} outAt={overFrom - 6} out={{y: 300, rotate: 20}} style={{left: 1360, top: 850}}>
        <Sticker size={110}>🔍</Sticker>
      </Fly>

      {/* Three things to know, one at a time. */}
      <Fly name="Caption: the stake" at={12} length={12} from={{x: 520, rotate: 10}} rotate={3} outAt={marks.chip + 6} out={{x: 620, y: -200, rotate: 16}} style={{left: 1428, top: 70}}>
        <Card color={YELLOW} size={92} style={{padding: "26px 34px"}}>
          100 万
          <br />
          虚拟日元
        </Card>
      </Fly>
      <Fly name="Caption: the leverage" at={marks.chip + 10} length={12} from={{x: 520, rotate: -10}} rotate={-3} outAt={fallFrom - 6} out={{x: 620, y: -200, rotate: -16}} style={{left: 1420, top: 70}}>
        <Card color={BLUE} size={86} style={{padding: "26px 30px"}}>
          最高
          <br />
          25 倍杠杆
        </Card>
      </Fly>
      <Fly name="Caption: the intervention" at={fallFrom} length={9} from={{scale: 1.6, rotate: 12}} rotate={4} sway={1.5} outAt={overFrom - 6} outLength={8} out={{x: 620, y: -200, rotate: 16}} style={{left: 1424, top: 80}}>
        <Card color={YELLOW} size={88} style={{padding: "26px 32px"}}>
          🚨 日本
          <br />
          入市干预
        </Card>
      </Fly>
      <Fly name="Caption: the liquidation" at={overFrom - 2} length={9} from={{scale: 1.9, rotate: -14}} rotate={-5} sway={1} out={{x: 620, y: -200, rotate: 18}} style={{left: 1420, top: 96}}>
        <Card color={PINK} size={118} style={{borderWidth: 7, color: "#c8102e", padding: "26px 30px"}}>
          会爆仓
        </Card>
      </Fly>

      <Fly name="Why: the stop-out level" at={overFrom + 12} length={12} from={{y: 200, scale: 0.7}} rotate={-1.5} out={{y: 420, rotate: 8}} style={{left: 150, top: 860}}>
        <Tag size={60} style={{padding: "22px 48px"}}>维持率跌破 100%，强制平仓</Tag>
      </Fly>

      {faces.map(([face, from, to]) => between(frame, from, to) ? (
        <Fly key={face} name={`Face ${face}`} at={from} length={9} from={{scale: 0.55, rotate: 16}} rotate={5} sway={face === "😱" ? 5 : 2.5} outAt={to === durationInFrames ? end : 9999} out={{x: 520, y: 320, rotate: 30}} style={{left: 1520, top: 470}}>
          <Sticker size={250}>{face}</Sticker>
        </Fly>
      ) : null)}

      <Fly name="Bang sticker" at={overFrom} length={8} from={{scale: 0.3, rotate: -30}} rotate={-12} sway={3} out={{x: -400, y: -500, rotate: -40}} style={{left: 1180, top: 560}}>
        <Sticker size={230}>💥</Sticker>
      </Fly>
    </SceneChrome>
  );
};
