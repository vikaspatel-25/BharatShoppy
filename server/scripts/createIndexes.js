import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Creates required database indexes for BharatShopy:
 * - stores.slug (unique)
 * - stores.subdomain (unique)
 * - vendor_applications (partial unique: one pending application per email)
 * - auth_limits.expireAt (TTL index for automatic cleanup)
 * - products.storeId (catalog index)
 */
export async function createIndexes() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Error: MONGO_URI is required to create database indexes.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  try {
    console.log("Creating unique indexes on 'stores' collection...");
    const stores = db.collection("stores");
    await stores.createIndex({ slug: 1 }, { unique: true, sparse: true });
    console.log(" - Created unique index on stores.slug");
    await stores.createIndex({ subdomain: 1 }, { unique: true, sparse: true });
    console.log(" - Created unique index on stores.subdomain");

    console.log("Creating partial unique index on 'vendor_applications' collection...");
    const applications = db.collection("vendor_applications");
    await applications.createIndex(
      { email: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "pending" },
        name: "unique_pending_application_email",
      }
    );
    console.log(" - Created partial unique index for pending vendor applications");

    console.log("Creating TTL index on 'auth_limits' collection...");
    const authLimits = db.collection("auth_limits");
    await authLimits.createIndex(
      { expireAt: 1 },
      { expireAfterSeconds: 0, name: "auth_limits_ttl" }
    );
    console.log(" - Created TTL index on auth_limits.expireAt (expireAfterSeconds: 0)");

    console.log("Creating catalog index on 'products' collection...");
    const products = db.collection("products");
    await products.createIndex({ storeId: 1 });
    console.log(" - Created index on products.storeId");

    console.log("\nAll database indexes created successfully.");
  } catch (err) {
    console.error("Index creation error:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
