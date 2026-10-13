import type {CSSProperties} from "react";
import {Img} from "remotion";
import type {Rect} from "../project";
import {INK, NIGHT} from "../project";

/**
 * A real picture of the game in a rounded frame. `crop` is the part to show,
 * in the CSS pixels of the page that was photographed (`page` wide).
 */
export const Shot: React.FC<{
  src: string;
  width: number;
  /** Width of the photographed page, and the part of it to show. Without it the whole picture. */
  page?: number;
  crop?: Rect;
  /** Height over width of the whole picture, when there is no crop. */
  ratio?: number;
  radius?: number;
  border?: number;
  shadow?: boolean;
  style?: CSSProperties;
}> = ({src, width, page, crop, ratio = 9 / 16, radius = 30, border = 5, shadow = true, style}) => {
  const zoom = crop && page ? width / crop.width : 1;
  const height = crop ? crop.height * zoom : width * ratio;

  return (
    <div
      style={{
        backgroundColor: NIGHT,
        border: `${border}px solid ${INK}`,
        borderRadius: radius,
        boxShadow: shadow ? "18px 22px 0 rgba(32,37,43,0.16)" : undefined,
        boxSizing: "content-box",
        height,
        overflow: "hidden",
        position: "relative",
        width,
        ...style,
      }}
    >
      <Img
        src={src}
        style={
          crop && page
            ? {left: -crop.x * zoom, maxWidth: "none", position: "absolute", top: -crop.y * zoom, width: page * zoom}
            : {display: "block", height: "100%", width: "100%"}
        }
      />
    </div>
  );
};
