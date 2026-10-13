import {interpolate, useCurrentFrame} from "remotion";
import {OUT} from "../motion";
import {ACCENT} from "../project";

/** A circle that opens once around a point, where something is clicked at frame `at`. */
export const Ring: React.FC<{x: number; y: number; at: number; size?: number; color?: string}> = ({x, y, at, size = 110, color = ACCENT}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        border: `7px solid ${color}`,
        borderRadius: "50%",
        height: size,
        left: x - size / 2,
        opacity: interpolate(frame, [at, at + 3, at + 16], [0, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
        position: "absolute",
        scale: interpolate(frame, [at, at + 16], [0.4, 1.5], {easing: OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
        top: y - size / 2,
        width: size,
      }}
    />
  );
};
