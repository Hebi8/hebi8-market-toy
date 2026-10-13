import {Easing, interpolate} from "remotion";

export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IN = Easing.bezier(0.7, 0, 0.84, 0);

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

/** 0 before `start`, 1 from `start + length` on, arriving gently. */
export const arrive = (frame: number, start: number, length = 14) =>
  interpolate(frame, [start, start + length], [0, 1], {...clamp, easing: OUT});

/** 0 before `start`, 1 from `start + length` on, leaving faster and faster. */
export const leave = (frame: number, start: number, length = 12) =>
  interpolate(frame, [start, start + length], [0, 1], {...clamp, easing: IN});

export const between = (frame: number, start: number, end: number) => frame >= start && frame < end;
