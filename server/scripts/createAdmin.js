/**
 * ==============================================================================
 * Local Admin Creation Script
 * ==============================================================================
 *
 * This local script creates or updates an administrator account in MongoDB.
 * It has no HTTP route and must only be executed locally from the command line.
 *
 * Usage:
 *   1. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env or export them:
 *      ADMIN_EMAIL=admin@bharatshopy.com
 *      ADMIN_PASSWORD=YourStrongPasswordHere
 *      MONGO_URI=mongodb+srv://...
 *
 *   2. Run the script:
 *      node scripts/createAdmin.js
 *
 *   Or inline:
 *      ADMIN_EMAIL=admin@bharatshopy.com ADMIN_PASSWORD=Secret node scripts/createAdmin.js
 * ==============================================================================
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(serverRoot, ".env") });

export async function createAdminAccount(env = process.env) {
  const email = env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required to create an admin account."
    );
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long.");
  }

  const mongoUri = env.MONGO_URI;
  if (!mongoUri || mongoUri.includes("<username>")) {
    throw new Error(
      "A valid MONGO_URI is required to persist the admin account to MongoDB."
    );
  }

  console.log(`Connecting to database to provision admin: ${email}`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const adminsCol = db.collection("admins");

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const existing = await adminsCol.findOne({ email });
  if (existing) {
    await adminsCol.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordHash,
          updatedAt: now,
          verificationCodeHash: null,
          codeExpiresAt: null,
          codeAttempts: 0,
        },
      }
    );
    console.log(`✓ Admin account for ${email} updated successfully (ID: ${existing._id}).`);
  } else {
    const adminId = `admin_${Date.now()}`;
    await adminsCol.insertOne({
      _id: adminId,
      email,
      passwordHash,
      verificationCodeHash: null,
      codeExpiresAt: null,
      codeAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`✓ Admin account for ${email} created successfully (ID: ${adminId}).`);
  }

  await mongoose.disconnect();
  console.log("✓ Disconnected from database cleanly.");
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    process.argv[1].endsWith("createAdmin.js"));

if (isDirectRun) {
  createAdminAccount()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error creating admin account:", err.message);
      process.exit(1);
    });
}
