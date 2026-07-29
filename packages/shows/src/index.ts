import type { ShowConfig } from "@sw/arcade-engine";
import { YEAR_7_8 } from "./year78.js";
import { YEAR_9_10 } from "./year910.js";
import { PURE_SHAPES } from "./pureShapes.js";

export { YEAR_7_8 } from "./year78.js";
export { YEAR_9_10 } from "./year910.js";
export { PURE_SHAPES } from "./pureShapes.js";
export { buildCues, type ShowVoice } from "./cueFactory.js";

export const SHOWS: Record<string, ShowConfig> = {
  [YEAR_7_8.id]: YEAR_7_8,
  [YEAR_9_10.id]: YEAR_9_10,
  [PURE_SHAPES.id]: PURE_SHAPES,
};

export const ALL_SHOWS: ShowConfig[] = [YEAR_7_8, YEAR_9_10, PURE_SHAPES];
