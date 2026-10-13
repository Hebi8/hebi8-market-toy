// Which colour means "up". This is the only place the two colours are
// written down: the stylesheet gets them as custom properties (--up, --down
// and their variants), the chart and the level lines read them from here.
// Rising prices, profits and the buy button are "up"; falling prices, losses
// and the sell button are "down".
const GREEN = { line: "#1fb287", fill: "#178a69", soft: "rgba(31, 178, 135, 0.14)" };
const RED = { line: "#f0485b", fill: "#c2374a", soft: "rgba(240, 72, 91, 0.14)" };

export const PALETTES = {
  "green-up": { label: "绿涨红跌", up: GREEN, down: RED },
  "red-up": { label: "红涨绿跌", up: RED, down: GREEN },
};
export const DEFAULT_PALETTE = "green-up";

let current = DEFAULT_PALETTE;

/** Switches the page to palette `name` (an unknown name means the default) and returns the one in use. */
export function applyPalette(name) {
  current = name in PALETTES ? name : DEFAULT_PALETTE;
  const { style } = document.documentElement;
  for (const direction of ["up", "down"]) {
    const colour = PALETTES[current][direction];
    style.setProperty(`--${direction}`, colour.line);
    style.setProperty(`--${direction}-fill`, colour.fill);
    style.setProperty(`--${direction}-soft`, colour.soft);
  }
  return current;
}

export const paletteName = () => current;
export const palette = () => PALETTES[current];
export const otherPalette = () => Object.keys(PALETTES).find((name) => name !== current);

/** A colour the stylesheet defines, for what is drawn on a canvas. */
export const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
