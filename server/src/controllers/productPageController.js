import mongoose from "mongoose";
import { isStoreSubscriptionActive } from "../services/catalogVisibility.js";
import mockProducts from "../data/mockData/products.js";
import mockStores from "../data/mockData/stores.js";

async function getProductPage(req, res) {
  try {
    const { productId } = req.params;

    if (!productId || typeof productId !== "string" || !productId.trim()) {
      return res.status(404).json({ message: "Product not found" });
    }

    const db = mongoose.connection?.db;
    let product = null;
    let store = null;

    if (db) {
      const products = db.collection("products");
      const stores = db.collection("stores");

      if (typeof products.findOne === "function") {
        product = await products.findOne({
          _id: productId,
          isActive: { $ne: false },
        });
      } else {
        const all = await products.find({}).toArray();
        product = all.find((p) => p._id === productId && p.isActive !== false) || null;
      }

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (typeof stores.findOne === "function") {
        store = await stores.findOne({
          _id: product.storeId,
          isActive: { $ne: false },
        });
      } else {
        const allStores = await stores.find({}).toArray();
        store = allStores.find((s) => s._id === product.storeId && s.isActive !== false) || null;
      }
    } else {
      product = mockProducts.find(
        (p) => p._id === productId && p.isActive !== false
      );
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      store = mockStores.find(
        (s) => s._id === product.storeId && s.isActive !== false
      );
    }

    if (!store || !isStoreSubscriptionActive(store)) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({
      product: {
        ...product,
        store: {
          _id: store._id,
          storeName: store.storeName,
          slug: store.slug,
          description: store.description,
          logo: store.logo,
          images: store.images,
          storeCategory: store.storeCategory,
          city: store.city,
          state: store.state,
          location: store.location,
          address: store.address,
          contact: store.contact,
          businessHours: store.businessHours,
        },
      },
    });
  } catch (err) {
    console.error("getProductPage error:", err);
    return res.status(500).json({ message: "Failed to load product page" });
  }
}

export { getProductPage };
