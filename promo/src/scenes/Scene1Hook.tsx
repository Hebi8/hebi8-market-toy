import {useCurrentFrame} from "remotion";
import {Card, Tag} from "../components/Card";
import {Fly} from "../components/Fly";
import {SceneChrome} from "../components/SceneChrome";
import {Sticker} from "../components/Sticker";
import {between} from "../motion";
import {YELLOW} from "../project";

/** Where the viewer is: the anime is over and the hands are itching. Words and stickers only. */
export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneChrome>
      <Fly name="Screen sticker" at={-8} from={{x: -160, y: 60, rotate: -14, scale: 0.6}} out={{x: -520, y: -260, rotate: -30}} rotate={-8} sway={2} style={{left: 110, top: 60}}>
        <Sticker size={170}>📺</Sticker>
      </Fly>

      <Fly
        name="Hook line one"
        at={-6}
        from={{x: -220, rotate: -5}}
        out={{x: -900, y: -120, rotate: -10}}
        rotate={-2}
        style={{fontSize: 112, fontWeight: 900, left: 340, letterSpacing: -2, top: 180, whiteSpace: "nowrap"}}
      >
        看完《FX战士久留美》，
      </Fly>

      <Fly name="Hook line two" at={22} length={12} from={{scale: 0.55, rotate: 9}} out={{x: 900, y: 140, rotate: 16}} rotate={3} sway={1.2} style={{left: 620, top: 400}}>
        <Card color={YELLOW} size={200} style={{borderRadius: 40, borderWidth: 7, letterSpacing: -4, padding: "20px 64px 34px"}}>
          手痒了？
        </Card>
      </Fly>

      {between(frame, 8, 56) ? (
        <Fly name="Thinking face" at={8} from={{y: 200, rotate: -12}} rotate={-6} sway={2} outAt={999} style={{left: 250, top: 560}}>
          <Sticker size={250}>🤔</Sticker>
        </Fly>
      ) : null}
      {frame >= 56 ? (
        <Fly name="Smirking face" at={56} length={10} from={{scale: 0.6, rotate: 14}} out={{x: -620, y: 420, rotate: -24}} rotate={-4} sway={3} style={{left: 250, top: 560}}>
          <Sticker size={250}>😏</Sticker>
        </Fly>
      ) : null}

      <Fly name="Yen sticker" at={40} from={{y: -420, rotate: 30}} out={{x: 520, y: -420, rotate: 40}} rotate={10} sway={3} style={{left: 1560, top: 250}}>
        <Sticker size={150}>💴</Sticker>
      </Fly>
      <Fly name="Chart up sticker" at={48} from={{y: -520, rotate: -30}} out={{x: 620, y: 80, rotate: 30}} rotate={-9} sway={2.5} style={{left: 1610, top: 640}}>
        <Sticker size={170}>📈</Sticker>
      </Fly>
      <Fly name="Chart down sticker" at={58} from={{y: 420, rotate: 24}} out={{x: -200, y: 520, rotate: -30}} rotate={7} sway={2.5} style={{left: 640, top: 800}}>
        <Sticker size={140}>📉</Sticker>
      </Fly>

      <Fly name="Invitation" at={80} length={12} from={{scale: 0.6, y: 60}} out={{y: 420, rotate: 8}} rotate={-3} style={{left: 900, top: 830}}>
        <Tag size={58} style={{padding: "20px 44px"}}>来一局虚拟的 🎮</Tag>
      </Fly>
    </SceneChrome>
  );
};
