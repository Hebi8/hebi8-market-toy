import {useCurrentFrame} from "remotion";
import {Card, Tag} from "../components/Card";
import {Fly} from "../components/Fly";
import {SceneChrome} from "../components/SceneChrome";
import {Shot} from "../components/Shot";
import {Sticker} from "../components/Sticker";
import type {PvProps} from "../project";
import {ACCENT, YELLOW, capture, recorded} from "../project";

/** The share picture is 1080×1440; its QR code sits here (src/share-card.js). */
const CARD = {width: 1080, height: 1440, qr: {x: 72, y: 1096, size: 264}};
/** The phone the challenge card was photographed on is 390 CSS pixels wide (capture.mjs). */
const PHONE = 390;

/** One picture brings a friend to the same round. */
export const Scene5Challenge: React.FC<PvProps> = (props) => {
  const {rects} = recorded(props.manifest);
  const frame = useCurrentFrame();
  const card = {left: 120, top: 76, width: 690};
  const zoom = card.width / CARD.width;
  const qr = {left: card.left + 5 + CARD.qr.x * zoom, top: card.top + 5 + CARD.qr.y * zoom, size: CARD.qr.size * zoom};
  const challenge = {x: rects.challenge.x + 2, y: rects.challenge.y + 2, width: rects.challenge.width - 4, height: rects.challenge.height - 4};
  const pulse = 0.5 + 0.5 * Math.sin((frame - 60) / 5);

  return (
    <SceneChrome>
      <Fly name="Share picture" at={-4} length={22} from={{x: -300, y: -1000, rotate: -14}} out={{x: -1100, y: 100, rotate: -18}} style={{left: card.left, top: card.top}}>
        <Shot src={capture("share-card.png")} width={card.width} ratio={CARD.height / CARD.width} />
      </Fly>
      <Fly name="QR code highlight" at={56} length={10} from={{scale: 1.5}} out={{x: -1100, y: 100, rotate: -18}} style={{left: qr.left - 14, top: qr.top - 14}}>
        <div
          style={{
            border: `8px solid ${ACCENT}`,
            borderRadius: 26,
            boxShadow: `0 0 0 ${6 + pulse * 10}px rgba(79,124,255,${0.32 - pulse * 0.2})`,
            height: qr.size + 28,
            width: qr.size + 28,
          }}
        />
      </Fly>

      <Fly
        name="Headline"
        at={12}
        from={{x: 460, rotate: 5}}
        out={{x: 1000, y: -300, rotate: 10}}
        rotate={-1}
        style={{fontSize: 104, fontWeight: 900, left: 900, letterSpacing: -2, lineHeight: 1.16, top: 84, whiteSpace: "nowrap"}}
      >
        一张图，
        <br />
        叫朋友打<span style={{color: ACCENT}}>同一段行情</span>
      </Fly>

      <Fly name="Scan note" at={66} length={12} from={{x: 120, scale: 0.6}} out={{y: 420, rotate: -12}} rotate={-4} style={{left: 650, top: 898}}>
        <Card color={YELLOW} size={50} style={{padding: "16px 28px"}}>
          👈 扫码
        </Card>
      </Fly>

      <Fly name="Challenge card" at={84} length={22} from={{x: 1100, y: 260, rotate: 14}} out={{x: 1200, y: 240, rotate: 16}} rotate={1.5} style={{left: 900, top: 470}}>
        <Shot src={capture("challenge-phone.png")} page={PHONE} crop={challenge} width={880} radius={26} />
      </Fly>

      <Fly name="Same round note" at={120} length={12} from={{scale: 0.6, y: 60}} out={{x: 600, y: 420, rotate: 10}} rotate={-2} style={{left: 1000, top: 900}}>
        <Tag size={44}>同一个场景，同一个品种</Tag>
      </Fly>

      <Fly name="Letter sticker" at={30} from={{y: -320, rotate: 30}} out={{x: 500, y: -500, rotate: 40}} rotate={10} sway={3} style={{left: 1700, top: 300}}>
        <Sticker size={150}>📨</Sticker>
      </Fly>
      <Fly name="Mischief face" at={110} length={10} from={{scale: 0.5, rotate: 20}} out={{x: 500, y: 400, rotate: 30}} rotate={8} sway={4} style={{left: 1640, top: 800}}>
        <Sticker size={200}>😈</Sticker>
      </Fly>
    </SceneChrome>
  );
};
