/**
 * ==============================================================================
 * Local Test Vendor Provisioning Script
 * ==============================================================================
 *
 * This local script creates or updates an approved vendor account in MongoDB
 * for local development and test scenarios. It has no HTTP route and refuses
 * to run in production.
 *
 * Usage:
 *   1. Set VENDOR_EMAIL, STORE_ID, and MONGO_URI in server/.env or export them:
 *      VENDOR_EMAIL=vendor@bharatshopy.com
 *      STORE_ID=store_0103
 *      MONGO_URI=mongodb+srv://...
 *
 *   2. Run the script:
 *      node scripts/createTestVendor.js
 *
 *   Or inline:
 *      VENDOR_EMAIL=artisan@bharatshopy.com STORE_ID=store_0103 node scripts/createTestVendor.js
 * ==============================================================================
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(serverRoot, ".env") });

export async function createTestVendorAccount(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to execute createTestVendor script in production environment."
    );
  }

  const email = (env.VENDOR_EMAIL || "vendor@bharatshopy.com").toLowerCase().trim();
  const storeId = (env.STORE_ID || "store_0103").trim();

  const mongoUri = env.MONGO_URI;
  if (!mongoUri || mongoUri.includes("<username>")) {
    throw new Error(
      "A valid MONGO_URI is required to persist the test vendor account to MongoDB."
    );
  }

  console.log(`Connecting to database to provision test vendor: ${email} -> ${storeId}`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const vendorsCol = db.collection("vendors");

  const existing = await vendorsCol.findOne({ email });
  const now = new Date().toISOString();

  if (existing) {
    await vendorsCol.updateOne(
      { email },
      {
        $set: {
          storeId,
          status: "approved",
          updatedAt: now,
        },
      }
    );
    console.log(`Updated existing vendor '${email}' to status='approved' for store '${storeId}'.`);
  } else {
    const newVendor = {
      _id: `vendor_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email,
      storeId,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    };
    await vendorsCol.insertOne(newVendor);
    console.log(`Created new approved vendor '${email}' for store '${storeId}'.`);
  }

  await mongoose.disconnect();
  console.log("Database disconnected. Test vendor provisioning completed.");
}

// Auto-run when executed directly from CLI
const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() ===
    path.resolve(process.argv[1]).toLowerCase();

if (isDirectRun) {
  createTestVendorAccount()
    .then(() => {
      console.log("Vendor creation script finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Vendor creation script failed:", err.message);
      process.exit(1);
    });
}
