import type { Format } from "../types.js";

// Space and setup time by configuration (Project F5, Standard Setup
// Requirements). Only the configurations Alex plays himself are listed; a
// format missing here gets no space line in the draft rather than a guess.
export const SETUP_SPACE: Partial<Record<Format, string>> = {
  solo: "about 6 x 6 ft; 20-30 minutes to set up",
  duo: "about 8 x 8 ft; 30 minutes to set up",
  flamenco_duo: "about 8 x 8 ft; 30 minutes to set up",
  flamenco_trio: "15 x 6 ft minimum, 15 x 10 ft to give the dancer room; 45 minutes to set up",
  flamenco_trio_full: "15 x 6 ft minimum, 15 x 10 ft to give the dancer room; 45 minutes to set up",
};
