import {encode} from "uqr";
import {INK} from "../project";

/** A QR code of `text`, drawn as squares. */
export const Qr: React.FC<{text: string; size: number}> = ({text, size}) => {
  const {data} = encode(text, {border: 0, ecc: "M"});
  const count = data.length;

  return (
    <svg height={size} shapeRendering="crispEdges" viewBox={`0 0 ${count} ${count}`} width={size}>
      {data.map((row, y) => row.map((dark, x) => (dark ? <rect key={`${x}-${y}`} fill={INK} height={1} width={1} x={x} y={y} /> : null)))}
    </svg>
  );
};
