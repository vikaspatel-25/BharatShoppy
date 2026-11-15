/**
 * Copies the built-in default plans into the `subscription_plans` collection once, so
 * they can be edited from the admin panel's "Plans and limits" page.
 *
 * - Never overwrites a plan that already exists (it only inserts missing plan IDs).
 * - Refuses to run when NODE_ENV=production unless ALLOW_PLAN_SEED_IN_PRODUCTION=true.
 *
 * Usage, from server/:
 *   MONGO_URI=mongodb://localhost:27017/bharatshopy node scripts/seedPlans.js
 *
 * The first edit in the admin panel does the same thing automatically, so this script is
 * only needed to fill the collection before anyone edits a plan.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ensurePlansStored } from "../src/services/planService.js";

const __filename = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(__filename), "..");

/** Throws when the environment doesn't allow seeding. Exported for tests. */
export function assertPlanSeedAllowed(env = process.env) {
  if (env.NODE_ENV === "production" && env.ALLOW_PLAN_SEED_IN_PRODUCTION !== "true") {
    throw new Error("Refusing to seed plans in production. Set ALLOW_PLAN_SEED_IN_PRODUCTION=true if you really mean to.");
  }
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required.");
}

export async function seedPlans(env = process.env) {
  assertPlanSeedAllowed(env);
  await mongoose.connect(env.MONGO_URI);
  try {
    const added = await ensurePlansStored();
    console.log(`Plans added: ${added}. Existing plans were left unchanged.`);
    return added;
  } finally {
    await mongoose.disconnect();
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  dotenv.config({ path: path.join(serverRoot, ".env") });
  seedPlans().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
