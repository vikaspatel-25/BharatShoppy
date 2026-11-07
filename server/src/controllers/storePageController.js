import mongoose from "mongoose";
import { isStoreSubscriptionActive } from "../services/catalogVisibility.js";
import mockStores from "../data/mockData/stores.js";
import mockProducts from "../data/mockData/products.js";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getStorePage(req, res) {
  try {
    const { storeId } = req.params;

    if (!storeId || typeof storeId !== "string" || !storeId.trim()) {
      return res.status(400).json({
        message: "Store ID or slug is required",
      });
    }

    const normalizedId = storeId.trim().toLowerCase();
    const escapedId = escapeRegex(normalizedId);
    const db = mongoose.connection?.db;

    let store = null;
    let productsCollection = null;

    if (db) {
      const storesCollection = db.collection("stores");
      productsCollection = db.collection("products");

      store = await storesCollection.findOne({
        $or: [
          { _id: storeId },
          { slug: { $regex: new RegExp(`^${escapedId}$`, "i") } },
          { subdomain: { $regex: new RegExp(`^${escapedId}$`, "i") } },
        ],
      });
    } else {
      store = mockStores.find(
        (s) =>
          s._id?.toLowerCase() === normalizedId ||
          s.slug?.toLowerCase() === normalizedId ||
          s.subdomain?.toLowerCase() === normalizedId
      );
    }

    if (!store || store.isActive === false) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    const entityType =
      store.entityType ||
      (store.storeCategory?.toLowerCase().includes("organic")
        ? "farmer"
        : store.storeCategory?.toLowerCase().includes("service")
        ? "service_provider"
        : "shopkeeper");

    const isSubscriptionActive = isStoreSubscriptionActive(store);

    const enrichedStore = {
      ...store,
      entityType,
      subdomain: store.subdomain || store.slug,
      isSubscriptionActive,
    };

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 10;
    const startingIndex = (page - 1) * limit;

    let paginatedProducts = [];
    let total = 0;

    if (isSubscriptionActive) {
      if (productsCollection) {
        const productQuery = {
          storeId: store._id,
          isActive: { $ne: false },
        };
        total = await productsCollection.countDocuments(productQuery);
        paginatedProducts = await productsCollection
          .find(productQuery)
          .skip(startingIndex)
          .limit(limit)
          .toArray();
      } else {
        const storeProducts = mockProducts.filter(
          (product) => product.storeId === store._id && product.isActive !== false
        );
        total = storeProducts.length;
        paginatedProducts = storeProducts.slice(startingIndex, startingIndex + limit);
      }
    }

    return res.json({
      store: enrichedStore,
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        hasMore: startingIndex + paginatedProducts.length < total,
      },
    });
  } catch (err) {
    console.error("getStorePage error:", err);
    return res.status(500).json({ message: "Failed to load store page" });
  }
}

export { getStorePage };
