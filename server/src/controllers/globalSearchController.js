import mongoose from "mongoose";
import { filterActiveStores, filterProductsByActiveStores, isStoreSubscriptionActive } from "../services/catalogVisibility.js";
import mockProducts from "../data/mockData/products.js";
import mockStores from "../data/mockData/stores.js";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function globalSearch(req, res) {
  try {
    const query = req.query.q?.trim() || "";
    const city = req.query.city?.trim() || null;
    const category = req.query.category?.trim() || null;

    const productPage = Math.max(Number(req.query.productPage) || 1, 1);
    const storePage = Math.max(Number(req.query.storePage) || 1, 1);
    const limit = 10;

    if (!query) {
      return res.json({
        products: [],
        stores: [],
        pagination: {
          products: {
            page: productPage,
            limit,
            total: 0,
            hasMore: false,
          },
          stores: {
            page: storePage,
            limit,
            total: 0,
            hasMore: false,
          },
        },
      });
    }

    const db = mongoose.connection?.db;

    if (db) {
      const productsCol = db.collection("products");
      const storesCol = db.collection("stores");

      const escapedQuery = escapeRegex(query);
      const searchRegex = new RegExp(escapedQuery, "i");

      // 1. Query matching active stores
      const storeBaseQuery = { isActive: { $ne: false } };
      if (city) {
        storeBaseQuery.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") };
      }
      if (category) {
        storeBaseQuery.storeCategory = { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") };
      }

      // First retrieve candidate active stores to verify subscription status
      const candidateStores = await storesCol.find(storeBaseQuery).toArray();
      const activeStores = candidateStores.filter(isStoreSubscriptionActive);
      const activeStoreIds = activeStores.map((s) => s._id);

      // Filter matching stores by search text
      const filteredStores = activeStores.filter((store) => {
        const searchableText = [
          store.storeName,
          store.description,
          store.storeCategory,
          store.city,
          store.address?.area,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query.toLowerCase());
      });

      // 2. Query products scoped strictly to active store IDs
      let filteredProducts = [];
      let totalProducts = 0;

      if (activeStoreIds.length > 0) {
        const productQuery = {
          storeId: { $in: activeStoreIds },
          isActive: { $ne: false },
          $or: [
            { productName: searchRegex },
            { shortDescription: searchRegex },
            { brand: searchRegex },
            { category: searchRegex },
            { subCategory: searchRegex },
            { tags: searchRegex },
          ],
        };

        if (category) {
          productQuery.category = { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") };
        }

        totalProducts = await productsCol.countDocuments(productQuery);
        filteredProducts = await productsCol
          .find(productQuery)
          .skip((productPage - 1) * limit)
          .limit(limit)
          .toArray();
      }

      const storeStart = (storePage - 1) * limit;
      const storeEnd = storeStart + limit;
      const paginatedStores = filteredStores.slice(storeStart, storeEnd);

      return res.json({
        products: filteredProducts,
        stores: paginatedStores,
        pagination: {
          products: {
            page: productPage,
            limit,
            total: totalProducts,
            hasMore: (productPage - 1) * limit + filteredProducts.length < totalProducts,
          },
          stores: {
            page: storePage,
            limit,
            total: filteredStores.length,
            hasMore: storeEnd < filteredStores.length,
          },
        },
      });
    }

    // In-memory fallback
    const storesData = filterActiveStores(mockStores);
    const productsData = filterProductsByActiveStores(mockProducts, mockStores);

    let filteredProducts = productsData.filter((product) => {
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
      return searchableText.includes(query.toLowerCase());
    });

    let filteredStores = storesData.filter((store) => {
      const searchableText = [
        store.storeName,
        store.description,
        store.storeCategory,
        store.city,
        store.address?.area,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(query.toLowerCase());
    });

    if (city) {
      filteredProducts = filteredProducts.filter((product) => {
        const store = storesData.find((store) => store._id === product.storeId);
        return store && store.city?.toLowerCase() === city.toLowerCase();
      });

      filteredStores = filteredStores.filter(
        (store) => store.city?.toLowerCase() === city.toLowerCase()
      );
    }

    if (category) {
      filteredProducts = filteredProducts.filter(
        (product) => product.category?.toLowerCase() === category.toLowerCase()
      );

      filteredStores = filteredStores.filter(
        (store) => store.storeCategory?.toLowerCase() === category.toLowerCase()
      );
    }

    const productStart = (productPage - 1) * limit;
    const productEnd = productStart + limit;
    const paginatedProducts = filteredProducts.slice(productStart, productEnd);

    const storeStart = (storePage - 1) * limit;
    const storeEnd = storeStart + limit;
    const paginatedStores = filteredStores.slice(storeStart, storeEnd);

    return res.json({
      products: paginatedProducts,
      stores: paginatedStores,
      pagination: {
        products: {
          page: productPage,
          limit,
          total: filteredProducts.length,
          hasMore: productEnd < filteredProducts.length,
        },
        stores: {
          page: storePage,
          limit,
          total: filteredStores.length,
          hasMore: storeEnd < filteredStores.length,
        },
      },
    });
  } catch (err) {
    console.error("globalSearch error:", err);
    return res.status(500).json({ message: "Failed to perform global search" });
  }
}

export { globalSearch };
