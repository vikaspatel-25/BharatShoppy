import mongoose from "mongoose";
import { checkProductUploadQuota } from "../services/quotaService.js";
import {
  validateProductMedia,
  verifyUploadedMediaSizes,
  deleteCloudinaryMedia,
} from "../services/cloudinaryService.js";

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
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Updates vendor profile & entity metadata.
 */
export async function updateVendorProfile(req, res) {
  try {
    const { storeId } = req.params;
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ message: "Invalid request body." });
    }

    const {
      storeName,
      description,
      contact,
      businessHours,
      entityType,
      metadata,
      address,
    } = body;

    const store = req.store || (await resolveStore(storeId, req));
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // 1. Validate storeName
    if (storeName !== undefined) {
      if (typeof storeName !== "string" || !storeName.trim()) {
        return res.status(400).json({ message: "Store name must be a non-empty string." });
      }
    }

    // 2. Validate description
    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({ message: "Description must be a string." });
      }
    }

    // 3. Allowlist entityType
    if (entityType !== undefined) {
      const ALLOWED_ENTITIES = ["shopkeeper", "farmer", "service_provider"];
      if (!ALLOWED_ENTITIES.includes(entityType)) {
        return res.status(400).json({
          message: `Invalid entityType '${entityType}'. Allowed values: ${ALLOWED_ENTITIES.join(", ")}`,
        });
      }
    }

    // 4. Validate contact and phone format
    const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
    if (contact !== undefined) {
      if (typeof contact !== "object" || contact === null || Array.isArray(contact)) {
        return res.status(400).json({ message: "Contact details must be an object." });
      }
      if (contact.phone !== undefined && contact.phone !== null && contact.phone !== "") {
        if (typeof contact.phone !== "string" || !PHONE_REGEX.test(contact.phone.replace(/[\s-]/g, ""))) {
          return res.status(400).json({ message: "Invalid phone number format." });
        }
      }
      if (contact.whatsapp !== undefined && contact.whatsapp !== null && contact.whatsapp !== "") {
        if (typeof contact.whatsapp !== "string" || !PHONE_REGEX.test(contact.whatsapp.replace(/[\s-]/g, ""))) {
          return res.status(400).json({ message: "Invalid WhatsApp number format." });
        }
      }
      if (contact.email !== undefined && contact.email !== null && contact.email !== "") {
        if (typeof contact.email !== "string" || !contact.email.includes("@")) {
          return res.status(400).json({ message: "Invalid email address in contact." });
        }
      }
    }

    // 5. Validate address
    if (address !== undefined && address !== null) {
      if (typeof address !== "object" || Array.isArray(address)) {
        return res.status(400).json({ message: "Address must be an object." });
      }
    }

    // 6. Validate metadata
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        return res.status(400).json({ message: "Metadata must be an object." });
      }
    }

    const updateFields = {
      updatedAt: new Date().toISOString(),
    };

    if (storeName) updateFields.storeName = storeName.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (contact) {
      const cleanContact = { ...contact };
      if (typeof cleanContact.phone === "string") cleanContact.phone = cleanContact.phone.trim();
      if (typeof cleanContact.whatsapp === "string") cleanContact.whatsapp = cleanContact.whatsapp.trim();
      if (typeof cleanContact.email === "string") cleanContact.email = cleanContact.email.trim();
      updateFields.contact = { ...store.contact, ...cleanContact };
    }
    if (businessHours) updateFields.businessHours = businessHours;
    if (entityType) updateFields.entityType = entityType;
    if (metadata) updateFields.metadata = { ...store.metadata, ...metadata };
    if (address) updateFields.address = { ...store.address, ...address };

    const storesCollection = mongoose.connection.db.collection("stores");
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
    return res.status(500).json({ message: "Failed to update profile" });
  }
}

/**
 * Adds a new item/service to vendor catalog.
 */
export async function addVendorProduct(req, res) {
  try {
    const { storeId } = req.params;
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ message: "Invalid request body." });
    }

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
      imageAssets = [],
      attributes = {},
      tags = [],
      inStock = true,
      isActive = true,
    } = body;

    // 1. Validate productName
    if (!productName || typeof productName !== "string" || !productName.trim()) {
      return res.status(400).json({ message: "Product name is required and must be a non-empty string." });
    }

    // 2. Validate price: must be > 0, max >= min
    if (price === undefined || price === null) {
      return res.status(400).json({ message: "Product price is required." });
    }

    let minPrice = 0;
    let maxPrice = 0;
    let priceUnit = unit;
    let priceCurrency = "INR";

    if (typeof price === "object" && price !== null && !Array.isArray(price)) {
      minPrice = Number(price.min);
      maxPrice = price.max !== undefined && price.max !== null ? Number(price.max) : minPrice;
      priceUnit = price.unit || unit || "piece";
      priceCurrency = price.currency || "INR";
    } else if (typeof price === "number" || (typeof price === "string" && !isNaN(Number(price)))) {
      minPrice = Number(price);
      maxPrice = mrp !== undefined && mrp !== null && !isNaN(Number(mrp)) ? Number(mrp) : minPrice;
    } else {
      return res.status(400).json({ message: "Price must be a valid number or price object." });
    }

    if (isNaN(minPrice) || isNaN(maxPrice)) {
      return res.status(400).json({ message: "Price values must be valid numbers." });
    }

    if (minPrice <= 0) {
      return res.status(400).json({ message: "Price must be greater than 0." });
    }

    if (maxPrice < minPrice) {
      return res.status(400).json({ message: "Maximum price must be at or above minimum price." });
    }

    // 3. Validate string fields to prevent .trim() crashes on non-strings
    if (brand !== undefined && brand !== null && typeof brand !== "string") {
      return res.status(400).json({ message: "Brand must be a string." });
    }
    if (category !== undefined && category !== null && typeof category !== "string") {
      return res.status(400).json({ message: "Category must be a string." });
    }
    if (subCategory !== undefined && subCategory !== null && typeof subCategory !== "string") {
      return res.status(400).json({ message: "SubCategory must be a string." });
    }
    if (shortDescription !== undefined && shortDescription !== null && typeof shortDescription !== "string") {
      return res.status(400).json({ message: "Short description must be a string." });
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({ message: "Description must be a string." });
    }

    // 4. Validate images & imageAssets
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: "Images must be an array." });
    }
    if (!Array.isArray(imageAssets)) {
      return res.status(400).json({ message: "Image assets must be an array." });
    }

    const store = req.store || (await resolveStore(storeId, req));
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Enforce plan's maxImagesPerProduct limit on server
    const maxImages = store.limits?.maxImagesPerProduct || 5;
    if (images.length > maxImages || imageAssets.length > maxImages) {
      return res.status(400).json({
        message: `Images exceed maximum allowed limit of ${maxImages} for your plan.`,
      });
    }

    // Validate media format and reject base64 data: URLs
    const mediaCheck = validateProductMedia({
      images,
      imageAssets,
      storeId: store._id,
      existingProduct: null,
    });
    if (!mediaCheck.valid) {
      return res.status(400).json({ message: mediaCheck.message });
    }

    // Verify uploaded media sizes via Cloudinary API (enforce 5MB limit)
    const sizeCheck = await verifyUploadedMediaSizes(imageAssets);
    if (!sizeCheck.valid) {
      return res.status(400).json({ message: sizeCheck.message });
    }

    const productsCollection = mongoose.connection.db.collection("products");
    const currentCount = await productsCollection.countDocuments({
      storeId: store._id,
      isActive: { $ne: false },
    });
    const quotaCheck = checkProductUploadQuota(store, currentCount);

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        message: quotaCheck.message,
        reason: quotaCheck.reason,
        currentCount: quotaCheck.currentCount,
        limit: quotaCheck.limit,
      });
    }

    const formattedPrice = {
      min: minPrice,
      max: maxPrice,
      unit: priceUnit || "piece",
      currency: priceCurrency,
    };

    const newProduct = {
      _id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: store._id,
      productName: productName.trim(),
      brand: brand ? brand.trim() : undefined,
      category: category ? category.trim() : "General",
      subCategory: subCategory ? subCategory.trim() : undefined,
      price: formattedPrice,
      shortDescription: shortDescription ? shortDescription.trim() : "",
      description: description ? description.trim() : (shortDescription ? shortDescription.trim() : ""),
      images: images.length > 0 ? images : ["/mock/products/default.webp"],
      imageAssets,
      attributes: typeof attributes === "object" && attributes !== null && !Array.isArray(attributes) ? attributes : {},
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
    return res.status(500).json({ message: "Failed to add product" });
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves store by ID, slug, or subdomain from request context or database with case-insensitive lookup.
 */
async function resolveStore(storeId, req) {
  if (req?.store) return req.store;
  if (!storeId) return null;

  const storesCollection = mongoose.connection?.db?.collection("stores");
  if (!storesCollection) {
    return null;
  }
  const normalizedId = storeId.trim().toLowerCase();
  const escapedId = escapeRegex(normalizedId);
  return await storesCollection.findOne({
    $or: [
      { _id: storeId },
      { slug: { $regex: new RegExp(`^${escapedId}$`, "i") } },
      { subdomain: { $regex: new RegExp(`^${escapedId}$`, "i") } },
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

    // 1. Validate productName
    if (updates.productName !== undefined) {
      if (typeof updates.productName !== "string" || !updates.productName.trim()) {
        return res.status(400).json({ message: "Product name must be a non-empty string." });
      }
    }

    // 2. Validate price
    if (updates.price !== undefined) {
      let minPrice = 0;
      let maxPrice = 0;
      let priceUnit = existing.price?.unit || "piece";
      let priceCurrency = existing.price?.currency || "INR";

      if (typeof updates.price === "object" && updates.price !== null && !Array.isArray(updates.price)) {
        minPrice = Number(updates.price.min);
        maxPrice = updates.price.max !== undefined && updates.price.max !== null ? Number(updates.price.max) : minPrice;
        priceUnit = updates.price.unit || priceUnit;
        priceCurrency = updates.price.currency || priceCurrency;
      } else if (typeof updates.price === "number" || (typeof updates.price === "string" && !isNaN(Number(updates.price)))) {
        minPrice = Number(updates.price);
        maxPrice = updates.mrp !== undefined && updates.mrp !== null && !isNaN(Number(updates.mrp)) ? Number(updates.mrp) : minPrice;
      } else {
        return res.status(400).json({ message: "Price must be a valid number or price object." });
      }

      if (isNaN(minPrice) || isNaN(maxPrice)) {
        return res.status(400).json({ message: "Price values must be valid numbers." });
      }

      if (minPrice <= 0) {
        return res.status(400).json({ message: "Product price must be greater than 0." });
      }

      if (maxPrice < minPrice) {
        return res.status(400).json({ message: "Maximum price must be at or above minimum price." });
      }

      updates.price = {
        min: minPrice,
        max: maxPrice,
        unit: priceUnit,
        currency: priceCurrency,
      };
    }

    // 3. Validate string fields
    if (updates.brand !== undefined && updates.brand !== null && typeof updates.brand !== "string") {
      return res.status(400).json({ message: "Brand must be a string." });
    }
    if (updates.category !== undefined && updates.category !== null && typeof updates.category !== "string") {
      return res.status(400).json({ message: "Category must be a string." });
    }
    if (updates.subCategory !== undefined && updates.subCategory !== null && typeof updates.subCategory !== "string") {
      return res.status(400).json({ message: "SubCategory must be a string." });
    }
    if (updates.shortDescription !== undefined && updates.shortDescription !== null && typeof updates.shortDescription !== "string") {
      return res.status(400).json({ message: "Short description must be a string." });
    }
    if (updates.description !== undefined && updates.description !== null && typeof updates.description !== "string") {
      return res.status(400).json({ message: "Description must be a string." });
    }

    // 4. Validate array/object fields
    if (updates.images !== undefined && !Array.isArray(updates.images)) {
      return res.status(400).json({ message: "Images must be an array." });
    }
    if (updates.imageAssets !== undefined && !Array.isArray(updates.imageAssets)) {
      return res.status(400).json({ message: "Image assets must be an array." });
    }
    if (updates.tags !== undefined && !Array.isArray(updates.tags)) {
      return res.status(400).json({ message: "Tags must be an array." });
    }
    if (updates.attributes !== undefined && updates.attributes !== null && (typeof updates.attributes !== "object" || Array.isArray(updates.attributes))) {
      return res.status(400).json({ message: "Attributes must be an object." });
    }

    // Enforce plan's maxImagesPerProduct limit on server
    const maxImages = store.limits?.maxImagesPerProduct || 5;
    if (Array.isArray(updates.images) && updates.images.length > maxImages) {
      return res.status(400).json({
        message: `Images exceed maximum allowed limit of ${maxImages} for your plan.`,
      });
    }
    if (Array.isArray(updates.imageAssets) && updates.imageAssets.length > maxImages) {
      return res.status(400).json({
        message: `Images exceed maximum allowed limit of ${maxImages} for your plan.`,
      });
    }

    // Validate media format and reject base64 data: URLs
    if (updates.images !== undefined || updates.imageAssets !== undefined) {
      const mediaCheck = validateProductMedia({
        images: Array.isArray(updates.images) ? updates.images : [],
        imageAssets: Array.isArray(updates.imageAssets) ? updates.imageAssets : [],
        storeId: store._id,
        existingProduct: existing,
      });
      if (!mediaCheck.valid) {
        return res.status(400).json({ message: mediaCheck.message });
      }

      if (Array.isArray(updates.imageAssets)) {
        const sizeCheck = await verifyUploadedMediaSizes(updates.imageAssets);
        if (!sizeCheck.valid) {
          return res.status(400).json({ message: sizeCheck.message });
        }
      }
    }

    // Check quota if reactivating a deactivated product
    if (existing.isActive === false && updates.isActive === true) {
      const currentActiveCount = await productsCollection.countDocuments({
        storeId: store._id,
        isActive: { $ne: false },
      });
      const quotaCheck = checkProductUploadQuota(store, currentActiveCount);
      if (!quotaCheck.allowed) {
        return res.status(403).json({
          message: quotaCheck.message,
          reason: quotaCheck.reason,
          currentCount: quotaCheck.currentCount,
          limit: quotaCheck.limit,
        });
      }
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
      "imageAssets",
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
      updateFields.price = updates.price;
    }

    let removedAssets = [];
    const existingAssets = Array.isArray(existing.imageAssets) ? existing.imageAssets : [];
    if (updates.imageAssets !== undefined || updates.images !== undefined) {
      const newAssets = Array.isArray(updates.imageAssets) ? updates.imageAssets : [];
      const newImages = Array.isArray(updates.images) ? updates.images : [];
      const newPublicIds = new Set(newAssets.map((a) => a?.publicId).filter(Boolean));
      const newUrls = new Set(newImages);

      removedAssets = existingAssets.filter((a) => {
        if (!a?.publicId) return false;
        if (updates.imageAssets !== undefined && !newPublicIds.has(a.publicId)) {
          return true;
        }
        if (updates.images !== undefined && a.url && !newUrls.has(a.url)) {
          return true;
        }
        return false;
      });
    }

    if (updates.images !== undefined && updates.imageAssets === undefined && existing.imageAssets) {
      const newUrls = new Set(Array.isArray(updates.images) ? updates.images : []);
      updateFields.imageAssets = existing.imageAssets.filter((a) => newUrls.has(a.url));
    }

    await productsCollection.updateOne(
      { _id: productId, storeId: store._id },
      { $set: updateFields }
    );

    // Await Cloudinary deletion to guarantee completion before serverless runtime terminates
    if (removedAssets.length > 0) {
      await Promise.allSettled(
        removedAssets.map(async (asset) => {
          try {
            await deleteCloudinaryMedia(asset.publicId);
          } catch (err) {
            console.warn(`Failed to delete removed Cloudinary media ${asset.publicId}:`, err);
          }
        })
      );
    }

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
    return res.status(500).json({ message: "Failed to update product" });
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
    return res.status(500).json({ message: "Failed to delete product" });
  }
}
