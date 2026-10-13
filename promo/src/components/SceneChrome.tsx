import type {ReactNode} from "react";
import {AbsoluteFill} from "remotion";
import {INK} from "../project";

export const SceneChrome: React.FC<{children: ReactNode}> = ({children}) => {
  return (
    <AbsoluteFill
      lang="zh-CN"
      style={{
        backgroundColor: "#ebe9e3",
        color: INK,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(#d8d5cd 2px, transparent 2px), linear-gradient(90deg, #d8d5cd 2px, transparent 2px)",
          backgroundPosition: "-2px -2px",
          backgroundSize: "56px 56px",
          opacity: 0.72,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.72), rgba(255,255,255,0) 58%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
