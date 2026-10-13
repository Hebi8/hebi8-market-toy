import {staticFile} from "remotion";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const sceneDurations = {
  s1: 150,
  s2: 210,
  s3: 495,
  s4: 225,
  s5: 255,
  s6: 210,
} as const;

export const TOTAL_FRAMES = 1545;

/** How long the pieces of a scene take to fly apart at its end. */
export const SCATTER = 12;

export const INK = "#20252b";
export const PAPER = "#fbfaf7";
export const ACCENT = "#4f7cff";
export const YELLOW = "#fff5a8";
export const PINK = "#ffd3d3";
export const BLUE = "#d8f0ff";
export const GREEN = "#d9f2e3";
export const MUTED = "#596571";
/** The game's own background, behind its screenshots. */
export const NIGHT = "#0b0e11";

export const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
export const MONO = '"Cascadia Code", "SFMono-Regular", "DejaVu Sans Mono", monospace';

/** What is said about the Toy. Every number is the game's own: src/engine/rules.js and the scenario table. */
export const COPY = {
  name: "hebi8 外汇回放",
  toyUrl: "https://www.bilibili.com/toy/hebi8-fx-replay/index.html",
  toyUrlShown: "bilibili.com/toy/hebi8-fx-replay",
  repoShown: "github.com/Hebi8/hebi8-market-toy",
  disclaimer: "模拟游戏，历史数据回放，不构成投资建议",
} as const;

export type Rect = {x: number; y: number; width: number; height: number};

/** public/captures/manifest.json, as capture/capture.mjs writes it. */
export type Manifest = {
  fps: number;
  /** The viewport the round was recorded in, in CSS pixels. */
  stage: {width: number; height: number; scale: number};
  frames: {
    file: string;
    t: number;
    clock: string;
    speed: string;
    open: number;
    over: boolean;
    /** Where 净值, 浮动盈亏 and 实际杠杆 are in the account bar: x, y, width, height. */
    cells: [number, number, number, number][];
  }[];
  /** Frame numbers of the recording: what is clicked from that frame on. */
  marks: {chip: number; order: number; speed: number; fast: number; closeUp: number; over: number};
  rects: Record<
    | "rank" | "corner" | "chart" | "side" | "ticket" | "account" | "top" | "buy" | "sell" | "plus" | "lots" | "hint"
    | "speedButton" | "chip" | "dialog" | "shareDialog" | "challenge",
    Rect
  >;
};

export type PvProps = {manifest: Manifest | null};

export const capture = (file: string) => staticFile(`captures/${file}`);

/** The recorded round; without it there is nothing true to show. */
export const recorded = (manifest: Manifest | null): Manifest => {
  if (!manifest) {
    throw new Error("public/captures/ is empty: run `npm run capture` first");
  }

  return manifest;
};
