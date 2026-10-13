import {Card, Tag} from "../components/Card";
import {SceneChrome} from "../components/SceneChrome";
import {Shot} from "../components/Shot";
import {Sticker} from "../components/Sticker";
import type {PvProps} from "../project";
import {ACCENT, MONO, YELLOW, capture, recorded} from "../project";

/** One still for the video's cover: the question, the name, and the chart after the intervention. */
export const Cover: React.FC<PvProps> = (props) => {
  const {rects, stage} = recorded(props.manifest);
  // The chart and the account bar under it, without the order panel.
  const crop = {x: 0, y: rects.top.y, width: rects.chart.width, height: stage.height - rects.top.y - 20};

  return (
    <SceneChrome>
      <div style={{left: 900, position: "absolute", rotate: "4deg", top: 250}}>
        <Shot src={capture("after.png")} page={stage.width} crop={crop} width={960} />
      </div>

      <div style={{fontSize: 96, fontWeight: 900, left: 90, letterSpacing: -2, position: "absolute", rotate: "-2deg", top: 70, whiteSpace: "nowrap"}}>
        看完《FX战士久留美》，
      </div>
      <div style={{left: 120, position: "absolute", rotate: "-4deg", top: 250}}>
        <Card color={YELLOW} size={210} style={{borderRadius: 40, borderWidth: 7, letterSpacing: -4, padding: "20px 60px 34px"}}>
          手痒了？
        </Card>
      </div>

      <div style={{fontSize: 92, fontWeight: 900, left: 100, letterSpacing: -2, position: "absolute", top: 640, whiteSpace: "nowrap"}}>
        <span style={{fontFamily: MONO, letterSpacing: -5}}>hebi8</span> <span style={{color: ACCENT}}>外汇回放</span>
      </div>
      <div style={{left: 100, position: "absolute", rotate: "-2deg", top: 800}}>
        <Tag size={46}>真实历史行情 · 1 分钟线逐根回放</Tag>
      </div>
      <div style={{left: 104, position: "absolute", top: 930}}>
        <Tag size={38} style={{backgroundColor: "#fbfaf7", border: "4px solid #20252b", color: "#20252b"}}>
          虚拟资金 · 点开就能玩
        </Tag>
      </div>

      <div style={{left: 800, position: "absolute", rotate: "-8deg", top: 560}}>
        <Sticker size={230}>😏</Sticker>
      </div>
      <div style={{left: 1650, position: "absolute", rotate: "12deg", top: 80}}>
        <Sticker size={190}>💥</Sticker>
      </div>
      <div style={{left: 1700, position: "absolute", rotate: "-8deg", top: 860}}>
        <Sticker size={160}>💴</Sticker>
      </div>
    </SceneChrome>
  );
};
