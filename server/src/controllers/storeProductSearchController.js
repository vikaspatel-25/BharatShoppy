import mongoose from "mongoose";
import { isStoreSubscriptionActive } from "../services/catalogVisibility.js";

async function searchStoreProducts(req, res) {
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

  const storesCollection = mongoose.connection.db.collection("stores");
  const storesData = await storesCollection.find({}).toArray();

  const normalizedParam = storeIdParam?.trim().toLowerCase();
  const matchedStore = storesData.find(
    (s) =>
      s._id?.toLowerCase() === normalizedParam ||
      s.slug?.toLowerCase() === normalizedParam ||
      s.subdomain?.toLowerCase() === normalizedParam
  );

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

  const productsCollection = mongoose.connection.db.collection("products");
  const productsData = await productsCollection.find({}).toArray();

  const filteredProducts = productsData.filter((product) => {
    if (
      product.storeId !== targetStoreId ||
      product.isActive === false
    ) {
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

  res.json({
    products: paginatedProducts,
    pagination: {
      page,
      limit,
      total: filteredProducts.length,
      hasMore: end < filteredProducts.length,
    },
  });
}

export { searchStoreProducts };
