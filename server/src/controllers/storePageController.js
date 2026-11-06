import mongoose from "mongoose";
import { isStoreSubscriptionActive } from "../services/catalogVisibility.js";

async function getStorePage(req, res) {
  const { storeId } = req.params;

  if (!storeId) {
    return res.status(400).json({
      message: "Store ID or slug is required",
    });
  }

  const productsCollection = mongoose.connection.db.collection("products");
  const productsData = await productsCollection.find({}).toArray();

  const storesCollection = mongoose.connection.db.collection("stores");
  const storesData = await storesCollection.find({}).toArray();

  const normalizedId = storeId.trim().toLowerCase();
  const store = storesData.find(
    (s) =>
      s._id?.toLowerCase() === normalizedId ||
      s.slug?.toLowerCase() === normalizedId ||
      s.subdomain?.toLowerCase() === normalizedId
  );

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

  // Match products by the actual canonical store._id
  const storeProducts = productsData.filter(
    (product) =>
      product.storeId === store._id && product.isActive !== false
  );

  const productStart = (page - 1) * limit;
  const productEnd = productStart + limit;

  const paginatedProducts = storeProducts.slice(
    productStart,
    productEnd
  );

  res.json({
    store: enrichedStore,
    products: paginatedProducts,
    pagination: {
      page,
      limit,
      total: storeProducts.length,
      hasMore: productEnd < storeProducts.length,
    },
  });
}

export { getStorePage };
