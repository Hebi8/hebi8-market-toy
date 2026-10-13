import {EMOJI} from "../project";

/** An emoji as a sticker: the system's colour emoji font with a flat shadow under it. */
export const Sticker: React.FC<{children: string; size?: number}> = ({children, size = 180}) => {
  return (
    <div
      style={{
        filter: "drop-shadow(10px 14px 0 rgba(32,37,43,0.16))",
        fontFamily: EMOJI,
        fontSize: size,
        lineHeight: 1.1,
      }}
    >
      {children}
    </div>
  );
};
