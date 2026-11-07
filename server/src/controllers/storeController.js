import mongoose from "mongoose";
import { filterActiveStores } from "../services/catalogVisibility.js";
import mockStores from "../data/mockData/stores.js";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getStores(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const city = req.query.city?.trim();
    const category = req.query.category?.trim();
    const limit = 10;
    const startingIndex = (page - 1) * limit;

    const db = mongoose.connection?.db;

    if (db) {
      const storesCol = db.collection("stores");
      const storeQuery = { isActive: { $ne: false } };

      if (city) {
        storeQuery.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") };
      }
      if (category) {
        storeQuery.storeCategory = { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") };
      }

      const candidateStores = await storesCol.find(storeQuery).toArray();
      const activeStores = filterActiveStores(candidateStores);

      const paginatedStores = activeStores.slice(startingIndex, startingIndex + limit);

      return res.json({
        stores: paginatedStores,
        pagination: {
          page,
          limit,
          total: activeStores.length,
          hasMore: startingIndex + paginatedStores.length < activeStores.length,
        },
      });
    }

    // In-memory fallback
    let filteredStores = filterActiveStores(mockStores);

    if (city) {
      filteredStores = filteredStores.filter(
        (store) => store.city?.toLowerCase() === city.toLowerCase()
      );
    }

    if (category) {
      filteredStores = filteredStores.filter(
        (store) => store.storeCategory?.toLowerCase() === category.toLowerCase()
      );
    }

    const paginatedStores = filteredStores.slice(startingIndex, startingIndex + limit);

    return res.json({
      stores: paginatedStores,
      pagination: {
        page,
        limit,
        total: filteredStores.length,
        hasMore: startingIndex + paginatedStores.length < filteredStores.length,
      },
    });
  } catch (err) {
    console.error("getStores error:", err);
    return res.status(500).json({ message: "Failed to load stores" });
  }
}

export default getStores;
