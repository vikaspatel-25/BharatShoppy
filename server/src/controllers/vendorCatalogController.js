import mongoose from "mongoose";
import { checkProductUploadQuota } from "../services/quotaService.js";

/**
 * Retrieves the vendor dashboard data for a given store.
 */
export async function getVendorDashboardData(req, res) {
  try {
    const { storeId } = req.params;
    if (!storeId && !req.store) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const store = req.store || (await resolveStore(storeId, req));

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const productsCollection = mongoose.connection.db.collection("products");
    const products = await productsCollection
      .find({ storeId: store._id })
      .toArray();

    const entityType =
      store.entityType ||
      (store.storeCategory?.toLowerCase().includes("organic")
        ? "farmer"
        : store.storeCategory?.toLowerCase().includes("service")
        ? "service_provider"
        : "shopkeeper");

    return res.json({
      store: {
        ...store,
        entityType,
        subdomain: store.subdomain || store.slug,
      },
      products,
      stats: {
        totalProducts: products.length,
        activeProducts: products.filter((p) => p.isActive !== false).length,
      },
    });
  } catch (error) {
    console.error("getVendorDashboardData error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

/**
 * Updates vendor profile & entity metadata.
 */
export async function updateVendorProfile(req, res) {
  try {
    const { storeId } = req.params;
    const {
      storeName,
      description,
      contact,
      businessHours,
      entityType,
      metadata,
      address,
    } = req.body;

    const storesCollection = mongoose.connection.db.collection("stores");
    const store = req.store || (await resolveStore(storeId, req));

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const updateFields = {
      updatedAt: new Date().toISOString(),
    };

    if (storeName) updateFields.storeName = storeName;
    if (description !== undefined) updateFields.description = description;
    if (contact) updateFields.contact = { ...store.contact, ...contact };
    if (businessHours) updateFields.businessHours = businessHours;
    if (entityType) updateFields.entityType = entityType;
    if (metadata) updateFields.metadata = { ...store.metadata, ...metadata };
    if (address) updateFields.address = { ...store.address, ...address };

    await storesCollection.updateOne(
      { _id: store._id },
      { $set: updateFields }
    );

    const updated = await storesCollection.findOne({ _id: store._id });
    return res.json({
      message: "Vendor profile updated successfully",
      store: updated,
    });
  } catch (error) {
    console.error("updateVendorProfile error:", error);
    return res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
}

/**
 * Adds a new item/service to vendor catalog.
 */
export async function addVendorProduct(req, res) {
  try {
    const { storeId } = req.params;
    const {
      productName,
      brand,
      category = "General",
      subCategory,
      price,
      mrp,
      unit = "piece",
      shortDescription = "",
      description = "",
      images = [],
      attributes = {},
      tags = [],
      inStock = true,
      isActive = true,
    } = req.body;

    if (!productName || price === undefined) {
      return res.status(400).json({ message: "Product name and price are required" });
    }

    const store = req.store || (await resolveStore(storeId, req));

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const productsCollection = mongoose.connection.db.collection("products");
    const currentCount = await productsCollection.countDocuments({ storeId: store._id });
    const quotaCheck = checkProductUploadQuota(store, currentCount);

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        message: quotaCheck.message,
        reason: quotaCheck.reason,
        currentCount: quotaCheck.currentCount,
        limit: quotaCheck.limit,
      });
    }

    let formattedPrice;
    if (typeof price === "object" && price !== null) {
      formattedPrice = {
        min: Number(price.min) || 0,
        max: Number(price.max) || Number(price.min) || 0,
        unit: price.unit || unit || "piece",
        currency: price.currency || "INR",
      };
    } else {
      const minVal = Number(price) || 0;
      const maxVal = mrp ? Number(mrp) : minVal;
      formattedPrice = {
        min: minVal,
        max: maxVal,
        unit: unit || "piece",
        currency: "INR",
      };
    }

    const newProduct = {
      _id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: store._id,
      productName: productName.trim(),
      brand: brand ? brand.trim() : undefined,
      category,
      subCategory: subCategory ? subCategory.trim() : undefined,
      price: formattedPrice,
      shortDescription: shortDescription.trim(),
      description: description.trim() || shortDescription.trim(),
      images: images.length > 0 ? images : ["/mock/products/default.webp"],
      attributes: typeof attributes === "object" && attributes !== null ? attributes : {},
      tags: Array.isArray(tags) ? tags : [],
      isActive: isActive !== false,
      inStock: inStock !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await productsCollection.insertOne(newProduct);

    return res.status(201).json({
      message: "Item added successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("addVendorProduct error:", error);
    return res.status(500).json({ message: "Failed to add product", error: error.message });
  }
}

/**
 * Resolves store by ID, slug, or subdomain from request context or database.
 */
async function resolveStore(storeId, req) {
  if (req?.store) return req.store;
  if (!storeId) return null;

  const storesCollection = mongoose.connection.db.collection("stores");
  const normalizedId = storeId.trim().toLowerCase();
  return await storesCollection.findOne({
    $or: [
      { _id: storeId },
      { slug: normalizedId },
      { subdomain: normalizedId },
    ],
  });
}

/**
 * Updates an existing catalog item.
 */
export async function updateVendorProduct(req, res) {
  try {
    const { storeId, productId } = req.params;
    const updates = req.body || {};

    const store = await resolveStore(storeId, req);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const productsCollection = mongoose.connection.db.collection("products");
    const existing = await productsCollection.findOne({
      _id: productId,
      storeId: store._id,
    });

    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Explicit allowlist of editable product fields to prevent tampering
    const ALLOWED_UPDATE_FIELDS = [
      "productName",
      "brand",
      "category",
      "subCategory",
      "shortDescription",
      "description",
      "images",
      "attributes",
      "tags",
      "isActive",
      "inStock",
    ];

    const updateFields = {
      updatedAt: new Date().toISOString(),
    };

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (updates[field] !== undefined) {
        updateFields[field] = updates[field];
      }
    }

    if (updates.price !== undefined) {
      if (typeof updates.price === "object" && updates.price !== null) {
        updateFields.price = {
          min: Number(updates.price.min) || 0,
          max: Number(updates.price.max) || Number(updates.price.min) || 0,
          unit: updates.price.unit || existing.price?.unit || "piece",
          currency: updates.price.currency || "INR",
        };
      } else {
        updateFields.price = {
          min: Number(updates.price) || 0,
          max: updates.mrp ? Number(updates.mrp) : Number(updates.price) || 0,
          unit: updates.unit || existing.price?.unit || "piece",
          currency: "INR",
        };
      }
    }

    await productsCollection.updateOne(
      { _id: productId, storeId: store._id },
      { $set: updateFields }
    );

    const updated = await productsCollection.findOne({
      _id: productId,
      storeId: store._id,
    });
    return res.json({
      message: "Product updated successfully",
      product: updated,
    });
  } catch (error) {
    console.error("updateVendorProduct error:", error);
    return res.status(500).json({ message: "Failed to update product", error: error.message });
  }
}

/**
 * Soft deletes or toggles status of a catalog item.
 */
export async function deleteVendorProduct(req, res) {
  try {
    const { storeId, productId } = req.params;

    const store = await resolveStore(storeId, req);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const productsCollection = mongoose.connection.db.collection("products");

    const result = await productsCollection.updateOne(
      { _id: productId, storeId: store._id },
      { $set: { isActive: false, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deactivated successfully" });
  } catch (error) {
    console.error("deleteVendorProduct error:", error);
    return res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
}
