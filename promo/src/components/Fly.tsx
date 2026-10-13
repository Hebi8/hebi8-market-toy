import type {CSSProperties, ReactNode} from "react";
import {Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {arrive, leave} from "../motion";
import {SCATTER} from "../project";

type Offset = {x?: number; y?: number; rotate?: number; scale?: number};

/**
 * A piece of a scene: comes in from `from` at frame `at`, rests where `style`
 * puts it (turned by `rotate`, swaying by `sway` degrees), and flies off to
 * `out` at `outAt`, by default with everything else when the scene ends.
 */
export const Fly: React.FC<{
  name: string;
  children: ReactNode;
  at?: number;
  length?: number;
  from?: Offset;
  out?: Offset;
  outAt?: number;
  outLength?: number;
  rotate?: number;
  sway?: number;
  style?: CSSProperties;
}> = ({name, children, at = 0, length = 14, from = {}, out = {}, outAt, outLength = SCATTER, rotate = 0, sway = 0, style}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const leaving = outAt ?? durationInFrames - outLength;
  const p = arrive(frame, at, length);
  const q = leave(frame, leaving, outLength);
  const x = (from.x ?? 0) * (1 - p) + (out.x ?? 0) * q;
  const y = (from.y ?? 0) * (1 - p) + (out.y ?? 0) * q;
  const turn = rotate + (from.rotate ?? 0) * (1 - p) + (out.rotate ?? 0) * q
    + (sway ? Math.sin(((frame - at) / fps) * Math.PI * 1.6) * sway * p : 0);
  const size = interpolate(p, [0, 1], [from.scale ?? 1, 1]) * interpolate(q, [0, 1], [1, out.scale ?? 1]);
  const shown = frame < at ? 0 : interpolate(frame, [at, at + 3], [0.4, 1], {extrapolateRight: "clamp"})
    * interpolate(q, [0.55, 1], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});

  return (
    <Interactive.Div
      name={name}
      style={{
        position: "absolute",
        ...style,
        opacity: shown,
        rotate: `${turn}deg`,
        scale: size,
        translate: `${x}px ${y}px`,
      }}
    >
      {children}
    </Interactive.Div>
  );
};
