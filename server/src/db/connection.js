import mongoose from "mongoose";
import stores from "../data/mockData/stores.js";
import products from "../data/mockData/products.js";
import locations from "../data/mockData/locations.js";

export function shouldAutoSeed(env = process.env) {
  return env.NODE_ENV === "development" && env.ALLOW_SEED === "true";
}

async function connectDB() {
  if (!process.env.MONGO_URI) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required MONGO_URI in production environment.");
    }
    console.log("ℹ No MONGO_URI provided in environment.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database");

    // Auto-seed if stores/locations collections are empty ONLY when development and ALLOW_SEED=true
    if (shouldAutoSeed(process.env)) {
      const storesCol = mongoose.connection.db.collection("stores");
      const storesCount = await storesCol.countDocuments();
      if (storesCount === 0) {
        console.log("Empty stores collection detected. Auto-seeding mock data...");
        await storesCol.insertMany(stores);
        await mongoose.connection.db.collection("products").insertMany(products);
        console.log(`Auto-seeded ${stores.length} stores and ${products.length} products.`);
      }

      const locationsCol = mongoose.connection.db.collection("locations");
      const locationsCount = await locationsCol.countDocuments();
      if (locationsCount === 0) {
        console.log("Empty locations collection detected. Auto-seeding locations...");
        await locationsCol.insertMany(locations);
        console.log(`Auto-seeded ${locations.length} locations.`);
      }
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

export default connectDB;
