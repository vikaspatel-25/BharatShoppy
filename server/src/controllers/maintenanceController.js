import crypto from "node:crypto";
import mongoose from "mongoose";
import { insertSampleData, previewSampleData, removeSampleData } from "../services/sampleDataService.js";

/**
 * POST /api/maintenance/sample-data   body: { "mode": "dry-run" | "insert" | "remove" }
 *
 * Adds or removes the tagged sample data using the server's own database connection.
 * Switched off unless SAMPLE_DATA_SECRET is set: without it the route answers 404, as if it
 * didn't exist. With it, the request needs `Authorization: Bearer <SAMPLE_DATA_SECRET>`.
 * Set the secret only while using the route, then delete it and redeploy.
 */
export async function runSampleData(req, res) {
  const secret = process.env.SAMPLE_DATA_SECRET;
  if (!secret || secret.length < 32) return res.status(404).json({ message: "Not found" });

  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  if (!given || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: "Unauthorized" });

  const mode = req.body?.mode || "dry-run";
  if (!["dry-run", "insert", "remove"].includes(mode)) return res.status(400).json({ message: "mode must be dry-run, insert or remove." });

  const db = mongoose.connection?.db;
  if (!db) return res.status(503).json({ message: "Database unavailable." });

  try {
    const database = db.databaseName || null;
    if (mode === "insert") return res.json({ mode, database, added: await insertSampleData(db) });
    if (mode === "remove") return res.json({ mode, database, removed: await removeSampleData(db) });
    return res.json({ mode, database, preview: await previewSampleData(db) });
  } catch (error) {
    console.error("runSampleData error:", error);
    return res.status(500).json({ message: "Sample data could not be changed." });
  }
}
