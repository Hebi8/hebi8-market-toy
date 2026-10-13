import type {CSSProperties, ReactNode} from "react";
import {INK, PAPER} from "../project";

/** A paper label with the heavy outline and flat shadow everything in this video has. */
export const Card: React.FC<{
  children: ReactNode;
  color?: string;
  size?: number;
  style?: CSSProperties;
}> = ({children, color = PAPER, size = 54, style}) => {
  return (
    <div
      style={{
        backgroundColor: color,
        border: `5px solid ${INK}`,
        borderRadius: 26,
        boxShadow: "12px 14px 0 rgba(32,37,43,0.14)",
        color: INK,
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1.2,
        padding: "26px 40px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A dark capsule with light text, for the short asides. */
export const Tag: React.FC<{children: ReactNode; size?: number; style?: CSSProperties}> = ({children, size = 40, style}) => {
  return (
    <div
      style={{
        backgroundColor: INK,
        borderRadius: 999,
        color: "#f8f7f2",
        fontSize: size,
        fontWeight: 800,
        padding: "14px 30px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
