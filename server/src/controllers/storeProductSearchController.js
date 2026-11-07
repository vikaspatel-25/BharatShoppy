import mongoose from "mongoose";
import { isStoreSubscriptionActive } from "../services/catalogVisibility.js";
import mockStores from "../data/mockData/stores.js";
import mockProducts from "../data/mockData/products.js";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function searchStoreProducts(req, res) {
  try {
    const storeIdParam = req.params.storeId;
    const query = req.query.q?.trim().toLowerCase() || "";

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 10;

    if (!query) {
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

    const db = mongoose.connection?.db;
    let matchedStore = null;

    if (db) {
      const storesCollection = db.collection("stores");
      const normalizedParam = storeIdParam?.trim().toLowerCase();
      const escapedParam = escapeRegex(normalizedParam);

      matchedStore = await storesCollection.findOne({
        $or: [
          { _id: storeIdParam },
          { slug: { $regex: new RegExp(`^${escapedParam}$`, "i") } },
          { subdomain: { $regex: new RegExp(`^${escapedParam}$`, "i") } },
        ],
      });
    } else {
      const normalizedParam = storeIdParam?.trim().toLowerCase();
      matchedStore = mockStores.find(
        (s) =>
          s._id?.toLowerCase() === normalizedParam ||
          s.slug?.toLowerCase() === normalizedParam ||
          s.subdomain?.toLowerCase() === normalizedParam
      );
    }

    // If the store is found and its subscription is expired / inactive, shield items
    if (matchedStore && !isStoreSubscriptionActive(matchedStore)) {
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

    const targetStoreId = matchedStore ? matchedStore._id : storeIdParam;

    if (db) {
      const productsCollection = db.collection("products");
      const escapedQuery = escapeRegex(query);
      const searchRegex = new RegExp(escapedQuery, "i");

      const productQuery = {
        storeId: targetStoreId,
        isActive: { $ne: false },
        $or: [
          { productName: searchRegex },
          { shortDescription: searchRegex },
          { description: searchRegex },
          { brand: searchRegex },
          { category: searchRegex },
          { subCategory: searchRegex },
          { tags: searchRegex },
        ],
      };

      const total = await productsCollection.countDocuments(productQuery);
      const paginatedProducts = await productsCollection
        .find(productQuery)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return res.json({
        products: paginatedProducts,
        pagination: {
          page,
          limit,
          total,
          hasMore: (page - 1) * limit + paginatedProducts.length < total,
        },
      });
    }

    // In-memory fallback
    const filteredProducts = mockProducts.filter((product) => {
      if (product.storeId !== targetStoreId || product.isActive === false) {
        return false;
      }

      const searchableText = [
        product.productName,
        product.shortDescription,
        product.brand,
        product.category,
        product.subCategory,
        ...(product.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedProducts = filteredProducts.slice(start, end);

    return res.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total: filteredProducts.length,
        hasMore: end < filteredProducts.length,
      },
    });
  } catch (err) {
    console.error("searchStoreProducts error:", err);
    return res.status(500).json({ message: "Failed to search store products" });
  }
}

export { searchStoreProducts };
