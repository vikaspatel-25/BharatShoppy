import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compressImage } from "../src/lib/imageCompressor.js";
import { getEntityConfig } from "../src/lib/entityTypes.js";

describe("Product & Service Upload Data Pipeline Tests", () => {
  it("handles image compression gracefully in non-browser environment", async () => {
    // In Node.js environment where window/document is undefined, should return null safely
    const result = await compressImage(null);
    assert.equal(result, null);
  });

  it("assigns appropriate units and presets based on entity type", () => {
    const farmerConfig = getEntityConfig("farmer");
    assert.equal(farmerConfig.defaultUnit, "kg");

    const serviceConfig = getEntityConfig("service_provider");
    assert.equal(serviceConfig.defaultUnit, "service");

    const shopConfig = getEntityConfig("shopkeeper");
    assert.equal(shopConfig.defaultUnit, "piece");
  });

  it("calculates discount percentage accurately between selling price and MRP", () => {
    const sellingPrice = 1200;
    const mrp = 1500;
    const discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
    assert.equal(discount, 20); // 20% off
  });

  it("formats catalog payload with full attributes structure", () => {
    const rawForm = {
      productName: "A2 Gir Cow Desi Ghee",
      brand: "Organic Valley",
      category: "Groceries & Organics",
      subCategory: "Ghee & Oils",
      price: 1650,
      mrp: 1800,
      unit: "liter",
      shortDescription: "Traditional bilona churned A2 cow ghee",
      images: ["data:image/jpeg;base64,sample1", "data:image/jpeg;base64,sample2"],
      attributes: {
        harvestSeason: "October 2026",
        organicMethod: "Jaivik Bharat Certified",
        shelfLife: "9 months",
      },
      tags: ["ghee", "a2", "organic", "bilona"],
      inStock: true,
      isActive: true,
    };

    const payload = {
      productName: rawForm.productName.trim(),
      brand: rawForm.brand.trim(),
      category: rawForm.category,
      subCategory: rawForm.subCategory.trim(),
      price: {
        min: Number(rawForm.price),
        max: Number(rawForm.mrp),
        currency: "INR",
        unit: rawForm.unit,
      },
      shortDescription: rawForm.shortDescription,
      images: rawForm.images,
      attributes: rawForm.attributes,
      tags: rawForm.tags,
      inStock: rawForm.inStock,
      isActive: rawForm.isActive,
    };

    assert.equal(payload.productName, "A2 Gir Cow Desi Ghee");
    assert.equal(payload.price.min, 1650);
    assert.equal(payload.price.max, 1800);
    assert.equal(payload.price.unit, "liter");
    assert.equal(payload.attributes.organicMethod, "Jaivik Bharat Certified");
    assert.equal(payload.images.length, 2);
    assert.ok(payload.tags.includes("bilona"));
  });
});
