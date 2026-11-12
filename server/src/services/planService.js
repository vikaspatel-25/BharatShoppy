import mongoose from "mongoose";
import { defaultPlans, calculateDiscount } from "../data/mockData/subscriptionPlans.js";

/**
 * Reads plans from the `subscription_plans` collection, falling back to the built-in
 * defaults when the collection is empty or the database is unavailable.
 */
export async function listPlans({ includeInactive = false } = {}) {
  let plans = [];
  try {
    const col = mongoose.connection?.db?.collection("subscription_plans");
    if (col) {
      const rows = await col.find(includeInactive ? {} : { isActive: { $ne: false } }).toArray();
      if (Array.isArray(rows)) plans = rows;
    }
  } catch (err) {
    console.error("listPlans: falling back to default plans:", err?.message || err);
    plans = [];
  }
  if (plans.length === 0) {
    plans = defaultPlans.filter((p) => includeInactive || p.isActive !== false);
  }
  return plans
    .map((p) => ({ ...p, discountPercentage: calculateDiscount(p.originalPrice, p.discountedPrice) }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** One plan by ID, active or not, or null. */
export async function findPlan(planId) {
  if (!planId || typeof planId !== "string") return null;
  const plans = await listPlans({ includeInactive: true });
  return plans.find((p) => p.planId === planId) || null;
}

/** A map of planId to display name, for lists. */
export async function getPlanNameMap() {
  const plans = await listPlans({ includeInactive: true });
  return new Map(plans.map((p) => [p.planId, p.name]));
}
