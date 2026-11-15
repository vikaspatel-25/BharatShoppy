import mongoose from "mongoose";
import { defaultPlans, calculateDiscount } from "../data/mockData/subscriptionPlans.js";
import { LIMIT_LINE } from "../data/planClaims.js";

/**
 * The only place plans are read. Plans come from the `subscription_plans` collection,
 * with the built-in defaults as a fallback when the collection is empty or the database
 * is unavailable.
 *
 * Every plan returned has:
 *   features       the item and photo lines generated from the numbers, then the extra lines
 *   extraFeatures  the lines an admin edits
 *   discountPercentage, computed from the two prices
 */

export const PLANS_COLLECTION = "subscription_plans";

function plansCollection() {
  return mongoose.connection?.db?.collection(PLANS_COLLECTION) || null;
}

/** Extra lines for a plan: stored ones, or for older records the free-text lines that don't restate a limit. */
export function getExtraFeatures(plan) {
  if (Array.isArray(plan?.extraFeatures)) return plan.extraFeatures.filter((l) => typeof l === "string" && l.trim());
  const legacy = Array.isArray(plan?.features) ? plan.features : [];
  return legacy.filter((l) => typeof l === "string" && l.trim() && !LIMIT_LINE.test(l));
}

/** The item and photo lines, generated from the plan's numbers so they can't disagree with the limits. */
export function generateLimitLines(plan) {
  const lines = [];
  const items = Number(plan?.productMonthlyLimit) || 0;
  const photos = Number(plan?.maxImagesPerProduct) || 0;
  if (items > 0) lines.push(`Up to ${items} active ${items === 1 ? "item" : "items"} in your store`);
  if (photos > 0) lines.push(`Up to ${photos} ${photos === 1 ? "photo" : "photos"} per item`);
  return lines;
}

export function presentPlan(plan) {
  const extraFeatures = getExtraFeatures(plan);
  return {
    ...plan,
    isPopular: Boolean(plan.isPopular ?? /popular/i.test(String(plan.badge || ""))),
    extraFeatures,
    features: [...generateLimitLines(plan), ...extraFeatures],
    discountPercentage: calculateDiscount(plan.originalPrice, plan.discountedPrice),
  };
}

export async function listPlans({ includeInactive = false } = {}) {
  let plans = [];
  try {
    const col = plansCollection();
    if (col) {
      const rows = await col.find({}).toArray();
      if (Array.isArray(rows)) plans = rows;
    }
  } catch (err) {
    console.error("listPlans: falling back to default plans:", err?.message || err);
    plans = [];
  }
  if (plans.length === 0) plans = defaultPlans;
  return plans
    .filter((p) => includeInactive || p.isActive !== false)
    .map(presentPlan)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** One plan by ID, active or not, or null. */
export async function findPlan(planId) {
  if (!planId || typeof planId !== "string") return null;
  const plans = await listPlans({ includeInactive: true });
  return plans.find((p) => p.planId === planId) || null;
}

/** A plan a vendor may request now: it exists and is switched on. */
export async function findRequestablePlan(planId) {
  const plan = await findPlan(planId);
  return plan && plan.isActive !== false ? plan : null;
}

/** A map of planId to display name, for lists. */
export async function getPlanNameMap() {
  const plans = await listPlans({ includeInactive: true });
  return new Map(plans.map((p) => [p.planId, p.name]));
}

/** The limits a store gets when it is activated or renewed on a plan. */
export function limitsFromPlan(plan) {
  return {
    productMonthlyLimit: Number(plan?.productMonthlyLimit) || 50,
    maxImagesPerProduct: Number(plan?.maxImagesPerProduct) || 8,
  };
}

/**
 * Copies the defaults into an empty collection, so the first edit doesn't leave the
 * other plans missing. Never overwrites an existing plan. Returns how many were added.
 */
export async function ensurePlansStored() {
  const col = plansCollection();
  if (!col) return 0;
  let added = 0;
  for (const plan of defaultPlans) {
    const doc = { ...plan, extraFeatures: getExtraFeatures(plan) };
    delete doc.features;
    delete doc.discountPercentage;
    const res = await col.updateOne({ planId: plan.planId }, { $setOnInsert: { ...doc, createdAt: new Date().toISOString() } }, { upsert: true });
    if (res?.upsertedCount) added += 1;
  }
  return added;
}
