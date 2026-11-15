/**
 * Sample data for trying the site and both panels before real vendors join:
 * 10 shops (with vendor records), 10 items, 2 vendor applications and 1 plan request.
 *
 * Every record is tagged `sampleTag: "sample-2026-11"` and has an ID starting `sample_`,
 * so `--remove` deletes exactly what `--insert` added and nothing else.
 * Vendor emails are @example.com, so no real person can sign in as them or get email.
 *
 * Usage, from server/ with MONGO_URI in server/.env:
 *   node scripts/sampleData.js             dry run: shows the target database and what would change
 *   node scripts/sampleData.js --insert    adds the sample data; existing records are never overwritten
 *   node scripts/sampleData.js --remove    deletes every record carrying the sample tag
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { insertSampleData, previewSampleData, removeSampleData } from "../src/services/sampleDataService.js";

const __filename = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(__filename), "..");

export { SAMPLE_TAG, buildSampleData, insertSampleData, removeSampleData } from "../src/services/sampleDataService.js";

async function main() {
  dotenv.config({ path: path.join(serverRoot, ".env") });
  const mode = process.argv.includes("--insert") ? "insert" : process.argv.includes("--remove") ? "remove" : "dry-run";
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing. Add it to server/.env.");

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  try {
    const host = mongoose.connection.host;
    console.log(`Database: ${db.databaseName} on ${host}`);
    if (mode === "dry-run") {
      console.log(await previewSampleData(db));
      console.log("Dry run only. Nothing changed. Use --insert to add or --remove to delete.");
    } else if (mode === "insert") {
      console.log("Added:", await insertSampleData(db));
    } else {
      console.log("Removed:", await removeSampleData(db));
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
