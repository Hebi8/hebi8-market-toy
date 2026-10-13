import {interpolate, useCurrentFrame} from "remotion";
import {Card, Tag} from "../components/Card";
import {Fly} from "../components/Fly";
import {SceneChrome} from "../components/SceneChrome";
import {Shot} from "../components/Shot";
import {Sticker} from "../components/Sticker";
import type {PvProps} from "../project";
import {ACCENT, BLUE, GREEN, PINK, YELLOW, capture, recorded} from "../project";

/** The scenario list without the empty part under it; the page is 1280 CSS pixels wide (capture.mjs). */
const HOME = {x: 0, y: 0, width: 1280, height: 640};

const EVENTS = [
  {text: "2008 雷曼", color: YELLOW, left: 90, top: 340, rotate: -5, from: {x: -520, rotate: -16}, out: {x: -700, y: -80, rotate: -20}},
  {text: "2016 英国脱欧", color: PINK, left: 150, top: 500, rotate: 3, from: {x: -560, rotate: 14}, out: {x: -760, y: 40, rotate: 16}},
  {text: "2019 日元闪崩", color: BLUE, left: 80, top: 660, rotate: -3, from: {x: -520, rotate: -12}, out: {x: -700, y: 160, rotate: -14}},
  {text: "2022 · 2024 日本干预", color: GREEN, left: 100, top: 886, rotate: 4, from: {x: -640, rotate: 12}, out: {x: -400, y: 420, rotate: 18}},
];

/** What it is: real historic moves, replayed bar by bar. The scenario list proves it. */
export const Scene2What: React.FC<PvProps> = ({manifest}) => {
  recorded(manifest);
  const frame = useCurrentFrame();

  return (
    <SceneChrome>
      <Fly
        name="Scenario list"
        at={4}
        length={22}
        from={{x: 420, y: -900, rotate: -13}}
        out={{x: 1300, y: -260, rotate: 14}}
        style={{left: 560, top: 300}}
      >
        {/* A slow push-in keeps the still alive while the stickers land. */}
        <div style={{scale: interpolate(frame, [30, 198], [1, 1.035], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), transformOrigin: "30% 40%"}}>
          <Shot src={capture("home.png")} page={HOME.width} crop={HOME} width={1290} />
        </div>
      </Fly>

      <Fly
        name="Headline"
        at={-5}
        from={{x: -260, rotate: -5}}
        out={{x: -200, y: -420, rotate: -8}}
        rotate={-1}
        style={{fontSize: 100, fontWeight: 900, left: 90, letterSpacing: -2, lineHeight: 1.16, top: 46, whiteSpace: "nowrap"}}
      >
        真实历史行情
        <div style={{color: ACCENT, fontSize: 76, marginTop: 6}}>1 分钟线，逐根回放</div>
      </Fly>

      {EVENTS.map((event, index) => (
        <Fly key={event.text} name={`Event ${event.text}`} at={48 + index * 13} from={event.from} out={event.out} rotate={event.rotate} style={{left: event.left, top: event.top}}>
          <Card color={event.color} size={50} style={{padding: "20px 32px"}}>
            {event.text}
          </Card>
        </Fly>
      ))}

      <Fly name="Counts" at={108} length={12} from={{scale: 0.6, y: -60}} out={{x: 500, y: -420, rotate: 10}} rotate={2} style={{left: 960, top: 150}}>
        <Tag size={37}>12 个场景 · USD/JPY · EUR/JPY · AUD/JPY</Tag>
      </Fly>

      <Fly name="Clock sticker" at={30} from={{y: -300, rotate: 30}} out={{x: 400, y: -500, rotate: 40}} rotate={12} sway={3} style={{left: 1730, top: 215}}>
        <Sticker size={140}>🕰️</Sticker>
      </Fly>
    </SceneChrome>
  );
};
