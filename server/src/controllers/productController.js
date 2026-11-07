import mongoose from "mongoose";
import { filterProductsByActiveStores, isStoreSubscriptionActive } from "../services/catalogVisibility.js";
import mockProducts from "../data/mockData/products.js";
import mockStores from "../data/mockData/stores.js";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getProducts(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const city = req.query.city?.trim();
    const category = req.query.category?.trim();
    const limit = 10;
    const startingIndex = (page - 1) * limit;

    const db = mongoose.connection?.db;

    if (db) {
      const storesCol = db.collection("stores");
      const productsCol = db.collection("products");

      const storeQuery = { isActive: { $ne: false } };
      if (city) {
        storeQuery.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") };
      }

      // Project only the fields needed from stores
      const matchingStores = await storesCol
        .find(storeQuery, {
          projection: {
            _id: 1,
            storeName: 1,
            slug: 1,
            city: 1,
            subscription: 1,
            isActive: 1,
          },
        })
        .toArray();

      const validStores = matchingStores.filter(isStoreSubscriptionActive);
      if (validStores.length === 0) {
        return res.json({
          products: [],
          pagination: {
            page,
            limit,
            total: 0,
            hasMore: false,
          },
        });
      }

      const validStoreIds = validStores.map((s) => s._id);
      const storeMap = new Map(
        validStores.map((s) => [
          s._id,
          {
            _id: s._id,
            storeName: s.storeName,
            slug: s.slug,
          },
        ])
      );

      const productQuery = {
        storeId: { $in: validStoreIds },
        isActive: { $ne: false },
      };

      if (category) {
        productQuery.category = { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") };
      }

      const total = await productsCol.countDocuments(productQuery);
      const paginatedProducts = await productsCol
        .find(productQuery)
        .skip(startingIndex)
        .limit(limit)
        .toArray();

      const productsWithStore = paginatedProducts.map((product) => ({
        ...product,
        store: storeMap.get(product.storeId) || null,
      }));

      return res.json({
        products: productsWithStore,
        pagination: {
          page,
          limit,
          total,
          hasMore: startingIndex + paginatedProducts.length < total,
        },
      });
    }

    // In-memory fallback for local development or testing without MongoDB
    let filteredProducts = filterProductsByActiveStores(mockProducts, mockStores);

    if (city) {
      const filteredStores = mockStores.filter(
        (store) => store.city?.toLowerCase() === city.toLowerCase()
      );
      const filteredStoreIds = filteredStores.map((store) => store._id);
      filteredProducts = filteredProducts.filter((product) =>
        filteredStoreIds.includes(product.storeId)
      );
    }

    if (category) {
      filteredProducts = filteredProducts.filter(
        (product) => product.category?.toLowerCase() === category.toLowerCase()
      );
    }

    const paginatedProducts = filteredProducts.slice(startingIndex, startingIndex + limit);
    const productsWithStore = paginatedProducts.map((product) => {
      const store = mockStores.find((store) => store._id === product.storeId);
      return {
        ...product,
        store: store
          ? {
              _id: store._id,
              storeName: store.storeName,
              slug: store.slug,
            }
          : null,
      };
    });

    return res.json({
      products: productsWithStore,
      pagination: {
        page,
        limit,
        total: filteredProducts.length,
        hasMore: startingIndex + limit < filteredProducts.length,
      },
    });
  } catch (err) {
    console.error("getProducts error:", err);
    return res.status(500).json({ message: "Failed to load products" });
  }
}

export { getProducts };
