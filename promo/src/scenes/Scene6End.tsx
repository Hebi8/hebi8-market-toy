import {Img} from "remotion";
import {Tag} from "../components/Card";
import {Fly} from "../components/Fly";
import {Qr} from "../components/Qr";
import {SceneChrome} from "../components/SceneChrome";
import {Sticker} from "../components/Sticker";
import type {PvProps} from "../project";
import {ACCENT, COPY, INK, MONO, MUTED, PAPER, capture, recorded} from "../project";

/** Where to find it. The last frames stand still long enough to read every line. */
export const Scene6End: React.FC<PvProps> = (props) => {
  recorded(props.manifest);

  return (
    <SceneChrome>
      <Fly name="Final card" at={-4} length={20} from={{y: 120, scale: 0.82}} outAt={9999} style={{left: 170, top: 120}}>
        <div
          style={{
            backgroundColor: PAPER,
            border: `6px solid ${INK}`,
            borderRadius: 38,
            boxShadow: "20px 24px 0 rgba(32,37,43,0.18)",
            height: 800,
            padding: "70px 80px",
            position: "relative",
            width: 1580,
          }}
        >
          <div style={{alignItems: "center", display: "flex", gap: 36}}>
            <Img src={capture("icon.png")} style={{border: `5px solid ${INK}`, borderRadius: 34, height: 150, width: 150}} />
            <div style={{fontSize: 118, fontWeight: 900, letterSpacing: -3, whiteSpace: "nowrap"}}>
              <span style={{fontFamily: MONO, letterSpacing: -6}}>hebi8</span> 外汇回放
            </div>
          </div>

          <div style={{fontSize: 54, fontWeight: 900, marginTop: 50}}>这条视频挂了 Toy 入口，点开就能玩</div>

          <div style={{color: ACCENT, fontFamily: MONO, fontSize: 52, fontWeight: 800, letterSpacing: -2, marginTop: 44}}>{COPY.toyUrlShown}</div>
          <div style={{color: MUTED, fontFamily: MONO, fontSize: 40, fontWeight: 700, letterSpacing: -1, marginTop: 22}}>{COPY.repoShown}</div>

          <div style={{bottom: 54, color: MUTED, fontSize: 32, fontWeight: 700, left: 80, position: "absolute"}}>{COPY.disclaimer}</div>

          <div style={{position: "absolute", right: 76, textAlign: "center", top: 330}}>
            <div style={{backgroundColor: "#fff", border: `5px solid ${INK}`, borderRadius: 24, padding: 22}}>
              <Qr text={COPY.toyUrl} size={300} />
            </div>
            <div style={{color: MUTED, fontSize: 30, fontWeight: 800, marginTop: 14}}>扫码打开 Toy</div>
          </div>
        </div>
      </Fly>

      <Fly name="Facts" at={30} length={12} from={{scale: 0.6, y: -40}} outAt={9999} rotate={-2} style={{left: 250, top: 76}}>
        <Tag size={40}>12 段日元大行情 · 3 个品种 · 1 分钟线</Tag>
      </Fly>
      <Fly name="Game sticker" at={24} from={{y: -300, rotate: 30}} outAt={9999} rotate={12} sway={3} style={{left: 1620, top: 40}}>
        <Sticker size={170}>🎮</Sticker>
      </Fly>
      <Fly name="Pointing sticker" at={44} from={{x: -200, rotate: -30}} outAt={9999} rotate={-8} sway={3} style={{left: 70, top: 830}}>
        <Sticker size={170}>🕹️</Sticker>
      </Fly>
    </SceneChrome>
  );
};
