import mongoose from "mongoose";
import stores from "../data/mockData/stores.js";
import products from "../data/mockData/products.js";

export function shouldAutoSeed(env = process.env) {
  return env.NODE_ENV === "development" && env.ALLOW_SEED === "true";
}

async function connectDB() {
  try {
    if (!process.env.MONGO_URI) {
      console.log("ℹ No MONGO_URI provided in environment.");
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database");

    // Auto-seed if stores collection is empty ONLY when development and ALLOW_SEED=true
    if (shouldAutoSeed(process.env)) {
      const storesCount = await mongoose.connection.db.collection("stores").countDocuments();
      if (storesCount === 0) {
        console.log("Empty stores collection detected. Auto-seeding mock data...");
        await mongoose.connection.db.collection("stores").insertMany(stores);
        await mongoose.connection.db.collection("products").insertMany(products);
        console.log(`Auto-seeded ${stores.length} stores and ${products.length} products.`);
      }
    }
  } catch (error) {
    console.error("MongoDB connection failed", error.message);
    process.exit(1);
  }
}

export default connectDB;