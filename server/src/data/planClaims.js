/**
 * Words a plan's text must not contain, because the features they describe aren't built
 * (M6). Used by the plan editor's validation and by tests/planClaims.test.js.
 */
export const BANNED_PLAN_WORDS = Object.freeze(["analytics", "priority", "24/7", "verified", "ranking", "placement"]);

/** The first banned word a line contains, or null. */
export function findBannedPlanWord(text) {
  const lower = String(text || "").toLowerCase();
  return BANNED_PLAN_WORDS.find((w) => lower.includes(w)) || null;
}

/** Matches a free-text line that restates an item or photo limit; those lines are generated. */
export const LIMIT_LINE = /\d+\s*(catalog\s+)?(products?|items?|photos?|images?|listings?)\b/i;
