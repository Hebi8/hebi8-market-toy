import { REPLAY, RULES } from "./engine/rules.js";

const two = (value) => String(value).padStart(2, "0");
const MINUS = "−";

export const yen = (value) => Math.round(value).toLocaleString("en-US");
export const signedYen = (value) => {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? MINUS : ""}${Math.abs(rounded).toLocaleString("en-US")}`;
};
export const price = (value) => value.toFixed(RULES.priceDecimals);
export const lots = (value) => value.toFixed(1);
export const percent = (value, digits = 2) => `${value > 0 ? "+" : value < 0 ? MINUS : ""}${Math.abs(value).toFixed(digits)}%`;
export const pairName = (pair) => `${pair.slice(0, 3)}/${pair.slice(3)}`;
/** up | down | flat, for colouring a signed number. */
export const tone = (value) => (value > 0 ? "up" : value < 0 ? "down" : "flat");

/** Unix seconds as a wall clock in the replay's timezone. */
function parts(time) {
  const shifted = new Date((time + REPLAY.utcOffsetHours * 3600) * 1000);
  return {
    date: `${shifted.getUTCFullYear()}-${two(shifted.getUTCMonth() + 1)}-${two(shifted.getUTCDate())}`,
    day: `${two(shifted.getUTCMonth() + 1)}-${two(shifted.getUTCDate())}`,
    time: `${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}`,
  };
}
export const clock = (time) => {
  const { day, time: hm } = parts(time);
  return `${day} ${hm}`;
};
export const dateTime = (time) => {
  const { date, time: hm } = parts(time);
  return `${date} ${hm}`;
};
export const timeOfDay = (time) => parts(time).time;

export function duration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

export const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
