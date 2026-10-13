import {Tag} from "../components/Card";
import {Fly} from "../components/Fly";
import {Ring} from "../components/Ring";
import {SceneChrome} from "../components/SceneChrome";
import {Shot} from "../components/Shot";
import {Sticker} from "../components/Sticker";
import type {PvProps} from "../project";
import {ACCENT, MUTED, capture, recorded} from "../project";

/** The result of that round, and where everybody's results meet. */
export const Scene4Result: React.FC<PvProps> = (props) => {
  const {rects, stage} = recorded(props.manifest);
  // The dialog without its own rounded corners, and the corner of the list with the two buttons.
  const dialog = {x: rects.dialog.x + 3, y: rects.dialog.y + 3, width: rects.dialog.width - 6, height: rects.dialog.height - 6};
  const {corner} = rects;
  const cornerAt = {left: 1150, top: 640, width: 600};
  const zoom = cornerAt.width / corner.width;
  const rank = {
    x: cornerAt.left + 5 + (rects.rank.x + rects.rank.width / 2 - corner.x) * zoom,
    y: cornerAt.top + 5 + (rects.rank.y + rects.rank.height / 2 - corner.y) * zoom,
  };

  return (
    <SceneChrome>
      <Fly name="Result page" at={-4} length={22} from={{x: -200, y: -980, rotate: -12}} out={{x: -1200, y: 200, rotate: -16}} style={{left: 80, top: 116}}>
        <Shot src={capture("result.png")} page={stage.width} crop={dialog} width={940} />
      </Fly>

      <Fly
        name="Headline"
        at={14}
        from={{x: 420, rotate: 5}}
        out={{x: 900, y: -260, rotate: 10}}
        rotate={-1}
        style={{fontSize: 118, fontWeight: 900, left: 1110, letterSpacing: -2, lineHeight: 1.14, top: 120, whiteSpace: "nowrap"}}
      >
        和所有人
        <br />
        <span style={{color: ACCENT}}>比收益率</span>
      </Fly>
      <Fly name="Subline" at={34} from={{x: 320}} out={{x: 900, rotate: 6}} style={{color: MUTED, fontSize: 42, fontWeight: 800, left: 1116, top: 420, whiteSpace: "nowrap"}}>
        每一局结算后，成绩进排行榜
      </Fly>

      <Fly name="Leaderboard entry" at={52} length={20} from={{x: 900, y: 200, rotate: 12}} out={{x: 1000, y: 300, rotate: 16}} rotate={2} style={{left: cornerAt.left, top: cornerAt.top}}>
        <Shot src={capture("rank.png")} width={cornerAt.width} ratio={corner.height / corner.width} radius={24} />
      </Fly>
      <Fly name="Where the entry is" at={64} length={12} from={{scale: 0.6, y: 40}} out={{x: 900, y: 400, rotate: 12}} rotate={-2} style={{left: 1190, top: 880}}>
        <Tag size={40}>首页右上角 · 排行榜</Tag>
      </Fly>
      <Ring at={84} {...rank} size={230} />
      <Ring at={120} {...rank} size={230} />
      <Ring at={156} {...rank} size={230} />

      <Fly name="Trophy sticker" at={70} from={{y: -300, rotate: -30}} out={{x: 500, y: -500, rotate: 30}} rotate={10} sway={3} style={{left: 1690, top: 480}}>
        <Sticker size={170}>🏆</Sticker>
      </Fly>
      <Fly name="Dizzy face" at={26} from={{scale: 0.5, rotate: -20}} out={{x: -500, y: 400, rotate: -30}} rotate={-10} sway={4} style={{left: 890, top: 16}}>
        <Sticker size={190}>😵</Sticker>
      </Fly>
    </SceneChrome>
  );
};
