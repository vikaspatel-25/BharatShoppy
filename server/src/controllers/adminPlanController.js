import mongoose from "mongoose";
import { calculateDiscount } from "../data/mockData/subscriptionPlans.js";
import { LIMIT_LINE, findBannedPlanWord } from "../data/planClaims.js";
import { PLANS_COLLECTION, ensurePlansStored, findPlan, listPlans, presentPlan } from "../services/planService.js";
import { logAdminAction } from "../services/auditLogService.js";

/**
 * Admin plan editor. Plans can be edited and switched off, never created or deleted here.
 * An edit changes no store: a store gets new limits at its next activation or renewal.
 */

const MAX_EXTRA_LINES = 8;
const MAX_LINE_LENGTH = 120;

function db() {
  return mongoose.connection?.db || null;
}

/** GET /api/admin/plans: every plan, switched off or not, with how many stores are on it. */
export async function listAdminPlans(req, res) {
  try {
    const plans = await listPlans({ includeInactive: true });
    const database = db();
    const counts = new Map();
    if (database) {
      const rows = await database
        .collection("stores")
        .aggregate([{ $group: { _id: "$subscription.plan", count: { $sum: 1 } } }])
        .toArray();
      for (const r of rows) if (r._id) counts.set(String(r._id), r.count);
    }
    return res.json({ plans: plans.map((p) => ({ ...p, storesOnPlan: counts.get(p.planId) || 0 })) });
  } catch (error) {
    console.error("listAdminPlans error:", error);
    return res.status(500).json({ message: "Failed to load plans." });
  }
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Checks an edit. Returns { error } or { update } with only the allowed fields. */
export function validatePlanEdit(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const update = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 80) return { error: "The plan name must be 2 to 80 characters." };
    const banned = findBannedPlanWord(body.name);
    if (banned) return { error: `The plan name can't mention "${banned}", because that isn't offered.` };
    update.name = body.name.trim();
  }
  for (const key of ["originalPrice", "discountedPrice"]) {
    if (body[key] !== undefined) {
      if (!isInt(body[key], 0, 1000000)) return { error: "Prices must be whole rupees from 0 to 10,00,000." };
      update[key] = body[key];
    }
  }
  if (body.productMonthlyLimit !== undefined) {
    if (!isInt(body.productMonthlyLimit, 1, 10000)) return { error: "The item limit must be a whole number from 1 to 10,000." };
    update.productMonthlyLimit = body.productMonthlyLimit;
  }
  if (body.maxImagesPerProduct !== undefined) {
    if (!isInt(body.maxImagesPerProduct, 1, 20)) return { error: "Photos per item must be a whole number from 1 to 20." };
    update.maxImagesPerProduct = body.maxImagesPerProduct;
  }
  if (body.extraFeatures !== undefined) {
    if (!Array.isArray(body.extraFeatures) || body.extraFeatures.length > MAX_EXTRA_LINES) return { error: `Give at most ${MAX_EXTRA_LINES} extra feature lines.` };
    const lines = [];
    for (const raw of body.extraFeatures) {
      if (typeof raw !== "string") return { error: "Each feature line must be text." };
      const line = raw.trim();
      if (!line) continue;
      if (line.length > MAX_LINE_LENGTH) return { error: `Each feature line must be ${MAX_LINE_LENGTH} characters or fewer.` };
      const banned = findBannedPlanWord(line);
      if (banned) return { error: `"${line}" mentions "${banned}", which isn't offered. Plans can only list what's built.` };
      if (LIMIT_LINE.test(line)) return { error: `"${line}" restates a limit. The item and photo lines are generated from the numbers.` };
      lines.push(line);
    }
    update.extraFeatures = lines;
  }
  for (const key of ["isPopular", "isActive"]) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return { error: `${key} must be true or false.` };
      update[key] = body[key];
    }
  }
  if (body.sortOrder !== undefined) {
    if (!isInt(body.sortOrder, 0, 1000)) return { error: "The sort order must be a whole number from 0 to 1000." };
    update.sortOrder = body.sortOrder;
  }
  if (Object.keys(update).length === 0) return { error: "Nothing to change." };
  return { update };
}

/** PUT /api/admin/plans/:planId */
export async function updateAdminPlan(req, res) {
  try {
    const { planId } = req.params;
    if (!planId || typeof planId !== "string" || planId.length > 60) return res.status(400).json({ message: "Invalid plan ID." });

    const { error, update } = validatePlanEdit(req.body);
    if (error) return res.status(400).json({ message: error });

    const database = db();
    if (!database) return res.status(503).json({ message: "Plans can't be edited while the database is unavailable." });

    const before = await findPlan(planId);
    if (!before) return res.status(404).json({ message: "Plan not found." });

    const merged = { ...before, ...update };
    if (merged.discountedPrice > merged.originalPrice) return res.status(400).json({ message: "The price can't be higher than the price before discount." });

    if (update.isActive === false && before.isActive !== false) {
      const active = (await listPlans()).filter((p) => p.planId !== planId);
      if (active.length === 0) return res.status(409).json({ message: "At least one plan must stay available for new requests." });
    }

    // The first edit stores the defaults, so the other plans don't vanish from the list
    await ensurePlansStored();

    if (update.isPopular !== undefined) update.badge = update.isPopular ? "Popular" : "";
    const set = { ...update, discountPercentage: calculateDiscount(merged.originalPrice, merged.discountedPrice), updatedAt: new Date().toISOString() };
    const col = database.collection(PLANS_COLLECTION);
    const result = await col.updateOne({ planId }, { $set: set, $unset: { features: "" } });
    if (!result?.matchedCount) return res.status(404).json({ message: "Plan not found." });

    const after = await findPlan(planId);
    const changed = Object.keys(update).filter((k) => k !== "badge");
    await logAdminAction({
      req,
      action: "plan.update",
      targetType: "plan",
      targetId: planId,
      targetName: after?.name || before.name,
      details: Object.fromEntries(changed.map((k) => [k, { from: before[k] ?? null, to: after?.[k] ?? null }])),
    });

    return res.json({ message: "Plan saved. Stores get the new limits at their next activation or renewal.", plan: presentPlan(after || merged) });
  } catch (error) {
    console.error("updateAdminPlan error:", error);
    return res.status(500).json({ message: "Failed to save the plan." });
  }
}
