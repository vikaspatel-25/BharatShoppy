import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductPayload,
  buildProfilePayload,
  countActiveItems,
  discountPercent,
  getGettingStarted,
  getItemState,
  getUploadAllowance,
  planFeatureLines,
  productErrorField,
  productToForm,
  profileErrorField,
  removePhoto,
  setCoverPhoto,
  storeToProfileForm,
  validateProductForm,
  validateProfileForm,
} from "../src/lib/vendorItems.js";

const NOW = new Date("2026-11-15T06:00:00Z");
const future = "2027-01-01T00:00:00Z";
const past = "2026-11-01T00:00:00Z";

describe("P6: item form", () => {
  it("builds the same payload the old upload modal sent", () => {
    const form = {
      ...productToForm(null, "farmer"),
      productName: "  A2 Ghee ",
      brand: " ",
      price: "1650",
      mrp: "1800",
      unit: "liter",
      shortDescription: " Bilona ghee ",
      images: ["https://res.cloudinary.com/x/a.jpg"],
      imageAssets: [{ url: "https://res.cloudinary.com/x/a.jpg", publicId: "bharatshopy/s/a" }],
      tags: ["ghee"],
      attributes: { shelfLife: "9 months" },
    };
    const p = buildProductPayload(form);
    assert.equal(p.productName, "A2 Ghee");
    assert.equal(p.brand, undefined);
    assert.deepEqual(p.price, { min: 1650, max: 1800, currency: "INR", unit: "liter" });
    assert.equal(p.description, "Bilona ghee", "description falls back to the summary");
    assert.equal(p.category, "Groceries & Organics");
    assert.equal(p.images.length, 1);
    assert.equal(p.imageAssets[0].publicId, "bharatshopy/s/a");
    assert.equal(p.isActive, true);
  });

  it("uses the price as the MRP when none is given, and shows an equal MRP as empty when editing", () => {
    const p = buildProductPayload({ ...productToForm(null, "shopkeeper"), productName: "Kurti", price: "999" });
    assert.equal(p.price.max, 999);
    const form = productToForm({ productName: "Kurti", price: { min: 999, max: 999, unit: "piece" } }, "shopkeeper");
    assert.equal(form.mrp, "");
    assert.equal(form.price, 999);
  });

  it("reads old products stored with a plain number price", () => {
    const form = productToForm({ productName: "Old", price: 250, unit: "kg", images: ["/a.jpg", null] }, "farmer");
    assert.equal(form.price, 250);
    assert.equal(form.unit, "kg");
    assert.deepEqual(form.images, ["/a.jpg"]);
  });

  it("returns field errors for a missing name, a bad price and an MRP below the price", () => {
    const base = productToForm(null, "shopkeeper");
    assert.deepEqual(Object.keys(validateProductForm(base)).sort(), ["price", "productName"]);
    assert.ok(validateProductForm({ ...base, productName: "x", price: "0" }).price);
    assert.ok(validateProductForm({ ...base, productName: "x", price: "100", mrp: "50" }).mrp);
    assert.deepEqual(validateProductForm({ ...base, productName: "x", price: "100", mrp: "150" }), {});
  });

  it("moves a photo to the cover and removes one, keeping imageAssets in step", () => {
    const form = {
      images: ["a", "b", "c"],
      imageAssets: [
        { url: "a", publicId: "pa" },
        { url: "c", publicId: "pc" },
      ],
    };
    const covered = setCoverPhoto(form, 2);
    assert.deepEqual(covered.images, ["c", "a", "b"]);
    assert.equal(covered.imageAssets[0].publicId, "pc");
    const removed = removePhoto(covered, 0);
    assert.deepEqual(removed.images, ["a", "b"]);
    assert.deepEqual(removed.imageAssets.map((x) => x.url), ["a"]);
  });

  it("computes the discount", () => {
    assert.equal(discountPercent(1200, 1500), 20);
    assert.equal(discountPercent(1500, 1200), 0);
  });

  it("maps server messages to fields", () => {
    assert.equal(productErrorField("Product name is required and must be a non-empty string."), "productName");
    assert.equal(productErrorField("Maximum price must be at or above minimum price."), "mrp");
    assert.equal(productErrorField("Price must be greater than 0."), "price");
    assert.equal(productErrorField("Images exceed maximum allowed limit of 5 for your plan."), "images");
    assert.equal(profileErrorField("Invalid WhatsApp number format."), "whatsapp");
    assert.equal(profileErrorField("Invalid phone number format."), "phone");
    assert.equal(profileErrorField("Store name must be a non-empty string."), "storeName");
  });
});

describe("P6: item state and upload allowance", () => {
  it("an admin hide wins over the vendor's switch", () => {
    assert.equal(getItemState({ isActive: true, moderation: { status: "hidden" } }), "hidden");
    assert.equal(getItemState({ isActive: false, moderation: { status: "hidden" } }), "hidden");
    assert.equal(getItemState({ isActive: false }), "inactive");
    assert.equal(getItemState({}), "active");
  });

  it("counts only items the vendor hasn't switched off, including hidden ones", () => {
    assert.equal(countActiveItems([{ isActive: true }, { isActive: false }, {}, { moderation: { status: "hidden" } }]), 3);
  });

  it("matches the server quota check: plan current and room left", () => {
    const store = { isActive: true, subscription: { status: "active", expiresAt: future }, limits: { productMonthlyLimit: 2 } };
    assert.equal(getUploadAllowance(store, 1, NOW).allowed, true);
    const full = getUploadAllowance(store, 2, NOW);
    assert.equal(full.allowed, false);
    assert.equal(full.reason, "quota_full");
    assert.equal(full.remaining, 0);
  });

  it("blocks when the end date has passed even if the stored status is active", () => {
    const store = { subscription: { status: "active", expiresAt: past }, limits: { productMonthlyLimit: 10 } };
    assert.equal(getUploadAllowance(store, 0, NOW).reason, "plan_ended");
  });

  it("blocks a store in the removal hold or switched off", () => {
    assert.equal(getUploadAllowance({ removalStatus: "pending_deletion", isActive: false }, 0, NOW).reason, "removal_hold");
    assert.equal(getUploadAllowance({ isActive: false, subscription: { status: "active", expiresAt: future } }, 0, NOW).reason, "plan_ended");
  });

  it("treats a store with no subscription record as current, with the server's default limit of 50", () => {
    const a = getUploadAllowance({ isActive: true }, 49, NOW);
    assert.equal(a.allowed, true);
    assert.equal(a.limit, 50);
  });
});

describe("P6: plan feature lines", () => {
  it("generates the item and photo lines from the numbers and drops free text that restates them", () => {
    const lines = planFeatureLines({
      productMonthlyLimit: 5,
      maxImagesPerProduct: 3,
      features: ["50 catalog products / services", "Up to 8 photos per item", "Dedicated subdomain storefront"],
    });
    assert.deepEqual(lines, ["Up to 5 active items in your store", "Up to 3 photos per item", "Dedicated subdomain storefront"]);
  });

  it("prefers extraFeatures when the plan has them", () => {
    const lines = planFeatureLines({ productMonthlyLimit: 1, maxImagesPerProduct: 1, extraFeatures: ["QR code"], features: ["ignored"] });
    assert.deepEqual(lines, ["Up to 1 active item in your store", "Up to 1 photo per item", "QR code"]);
  });
});

describe("P6: store profile and getting started", () => {
  it("validates with the server's phone rule and requires a WhatsApp number", () => {
    const form = storeToProfileForm({ storeName: "Vastra", contact: { whatsapp: "+91 98765-43210" } });
    assert.deepEqual(validateProfileForm(form), {});
    assert.ok(validateProfileForm({ ...form, whatsapp: "" }).whatsapp);
    assert.ok(validateProfileForm({ ...form, phone: "12ab" }).phone);
    assert.ok(validateProfileForm({ ...form, storeName: "  " }).storeName);
  });

  it("builds the profile payload in the shape the server reads", () => {
    const p = buildProfilePayload({ ...storeToProfileForm({}), storeName: " A ", city: " Pune ", entityType: "bogus" });
    assert.equal(p.storeName, "A");
    assert.equal(p.entityType, "shopkeeper");
    assert.equal(p.address.city, "Pune");
    assert.ok("whatsapp" in p.contact);
  });

  it("works out the checklist from data on record", () => {
    const empty = getGettingStarted({ storeName: "A" }, [], { shared: false });
    assert.equal(empty.done, 0);
    assert.equal(empty.complete, false);
    const store = { storeName: "A", description: "d", contact: { whatsapp: "+919876543210" }, address: { city: "Pune" } };
    const all = getGettingStarted(store, [{}], { shared: true });
    assert.equal(all.complete, true);
  });
});
