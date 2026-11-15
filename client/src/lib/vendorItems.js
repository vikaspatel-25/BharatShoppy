/**
 * Plain helpers for the vendor portal: the item form, the store profile form, the plan's
 * upload allowance and the getting-started checklist. No React and no imports, so the
 * tests can load this file directly.
 */

export const UNIT_PRESETS = {
  shopkeeper: ["piece", "set", "pair", "meter", "pack"],
  farmer: ["kg", "gram", "quintal", "liter", "crate", "box", "dozen"],
  service_provider: ["hour", "service", "visit", "consultation", "day", "job"],
};

export const DEFAULT_UNITS = { shopkeeper: "piece", farmer: "kg", service_provider: "service" };

export const CATEGORY_PRESETS = [
  "Apparel & Fashion",
  "Groceries & Organics",
  "Electronics",
  "Furniture & Home Decor",
  "Home & Garden",
  "Sports & Outdoors",
  "Jewelry & Watches",
  "Health & Wellness",
  "Services & Repairs",
  "Handicrafts & Art",
  "Books & Stationery",
];

/** Item details that depend on the kind of seller. Stored under product.attributes. */
export const ITEM_DETAIL_FIELDS = {
  farmer: [
    { key: "harvestSeason", label: "Harvest season or date", placeholder: "For example, October 2026 fresh harvest" },
    { key: "organicMethod", label: "Farming method", placeholder: "For example, grown without pesticides" },
    { key: "shelfLife", label: "Shelf life and storage", placeholder: "For example, best within 6 months, keep cool and dry" },
    { key: "minimumBulk", label: "Minimum bulk order", placeholder: "For example, 5 kg minimum for the wholesale rate" },
  ],
  service_provider: [
    { key: "duration", label: "Typical duration", placeholder: "For example, 2 to 3 hours on site" },
    { key: "serviceArea", label: "Service area", placeholder: "For example, within 15 km" },
    { key: "inclusions", label: "What's included", placeholder: "For example, fabric, one trial fitting, lining", wide: true },
  ],
  shopkeeper: [
    { key: "fabric", label: "Fabric or material", placeholder: "For example, cotton silk" },
    { key: "sizes", label: "Sizes available", placeholder: "For example, S, M, L, XL" },
    { key: "care", label: "Care instructions", placeholder: "For example, hand wash or dry clean", wide: true },
  ],
};

/** Store details that depend on the kind of seller. Stored under store.metadata. */
export const STORE_DETAIL_FIELDS = {
  farmer: [
    { key: "farmLocation", label: "Farm location or village", placeholder: "For example, Mandya" },
    { key: "produceSeason", label: "Harvest season or crops", placeholder: "For example, kharif harvest, millets" },
  ],
  service_provider: [
    { key: "experienceYears", label: "Experience", placeholder: "For example, 12 years" },
    { key: "serviceRadius", label: "Service radius", placeholder: "For example, up to 15 km" },
  ],
  shopkeeper: [
    { key: "specialty", label: "Store specialty", placeholder: "For example, hand-block printed ethnic wear" },
    { key: "deliveryNotes", label: "Pickup or delivery", placeholder: "For example, in-store trials and home delivery" },
  ],
};

export function normaliseEntityType(entityType) {
  return ["shopkeeper", "farmer", "service_provider"].includes(entityType) ? entityType : "shopkeeper";
}

/** Words for "item" that suit the kind of seller. */
export function itemWords(entityType) {
  const t = normaliseEntityType(entityType);
  if (t === "service_provider") return { one: "service", many: "services", nameLabel: "Service name", namePlaceholder: "For example, bridal blouse hand embroidery" };
  if (t === "farmer") return { one: "item", many: "items", nameLabel: "Produce name", namePlaceholder: "For example, A2 desi cow ghee" };
  return { one: "item", many: "items", nameLabel: "Item name", namePlaceholder: "For example, hand-block printed cotton kurti" };
}

export function defaultCategory(entityType) {
  const t = normaliseEntityType(entityType);
  if (t === "farmer") return "Groceries & Organics";
  if (t === "service_provider") return "Services & Repairs";
  return "Apparel & Fashion";
}

/** Form state for a new item, or for editing an existing one. */
export function productToForm(product, entityType) {
  const t = normaliseEntityType(entityType);
  const unit = DEFAULT_UNITS[t];
  if (!product) {
    return {
      productName: "",
      brand: "",
      category: defaultCategory(t),
      subCategory: "",
      price: "",
      mrp: "",
      unit,
      shortDescription: "",
      description: "",
      images: [],
      imageAssets: [],
      inStock: true,
      isActive: true,
      tags: [],
      attributes: {},
    };
  }
  const priceObj = product.price && typeof product.price === "object" ? product.price : null;
  const min = priceObj ? priceObj.min : product.price;
  const max = priceObj ? priceObj.max : product.mrp;
  return {
    productName: product.productName || "",
    brand: product.brand || "",
    category: product.category || defaultCategory(t),
    subCategory: product.subCategory || "",
    price: min ?? "",
    // An MRP equal to the price was saved by the old form when none was given; show it as empty.
    mrp: max != null && Number(max) !== Number(min) ? max : "",
    unit: priceObj?.unit || product.unit || unit,
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    images: Array.isArray(product.images) ? product.images.filter((u) => typeof u === "string") : [],
    imageAssets: Array.isArray(product.imageAssets) ? product.imageAssets : [],
    inStock: product.inStock !== false,
    isActive: product.isActive !== false,
    tags: Array.isArray(product.tags) ? product.tags : [],
    attributes: product.attributes && typeof product.attributes === "object" ? product.attributes : {},
  };
}

/** Field errors for the item form, keyed by field. Empty object when it's valid. */
export function validateProductForm(form) {
  const errors = {};
  if (!String(form.productName || "").trim()) errors.productName = "Enter a name for this item.";
  const price = Number(form.price);
  if (form.price === "" || form.price === null || !Number.isFinite(price) || price <= 0) {
    errors.price = "Enter a price above 0.";
  }
  if (form.mrp !== "" && form.mrp !== null && form.mrp !== undefined) {
    const mrp = Number(form.mrp);
    if (!Number.isFinite(mrp) || mrp <= 0) errors.mrp = "Enter an MRP above 0, or leave it empty.";
    else if (!errors.price && mrp < price) errors.mrp = "The MRP can't be lower than the selling price.";
  }
  return errors;
}

/** The request body the server expects, built the same way the old upload form built it. */
export function buildProductPayload(form) {
  const shortDescription = String(form.shortDescription || "").trim();
  return {
    productName: String(form.productName || "").trim(),
    brand: String(form.brand || "").trim() || undefined,
    category: form.category,
    subCategory: String(form.subCategory || "").trim() || undefined,
    price: {
      min: Number(form.price),
      max: form.mrp !== "" && form.mrp != null ? Number(form.mrp) : Number(form.price),
      currency: "INR",
      unit: form.unit || "piece",
    },
    shortDescription,
    description: String(form.description || "").trim() || shortDescription,
    images: Array.isArray(form.images) ? form.images : [],
    imageAssets: Array.isArray(form.imageAssets) ? form.imageAssets : [],
    attributes: form.attributes || {},
    tags: Array.isArray(form.tags) ? form.tags : [],
    inStock: form.inStock !== false,
    isActive: form.isActive !== false,
  };
}

export function discountPercent(price, mrp) {
  const p = Number(price) || 0;
  const m = Number(mrp) || 0;
  return m > p && p > 0 ? Math.round(((m - p) / m) * 100) : 0;
}

/** Moves the photo at index to the front, keeping imageAssets in the same order. */
export function setCoverPhoto(form, index) {
  const url = form.images[index];
  if (url === undefined || index === 0) return form;
  const assets = form.imageAssets || [];
  const asset = assets.find((a) => a.url === url);
  return {
    ...form,
    images: [url, ...form.images.filter((_, i) => i !== index)],
    imageAssets: asset ? [asset, ...assets.filter((a) => a.url !== url)] : assets,
  };
}

export function removePhoto(form, index) {
  const url = form.images[index];
  return {
    ...form,
    images: form.images.filter((_, i) => i !== index),
    imageAssets: (form.imageAssets || []).filter((a) => a.url !== url),
  };
}

/** "active", "inactive" or "hidden" (hidden by an admin, which wins over the vendor's switch). */
export function getItemState(product) {
  if (product?.moderation?.status === "hidden") return "hidden";
  return product?.isActive === false ? "inactive" : "active";
}

/** Items that count toward the plan's limit: every item the vendor hasn't deactivated. */
export function countActiveItems(products = []) {
  return products.filter((p) => p && p.isActive !== false).length;
}

/**
 * Whether the vendor may add or reactivate an item, worked out exactly as the server's
 * quota check does (server/src/services/quotaService.js), so the form blocks before any
 * photo upload starts instead of after.
 */
export function getUploadAllowance(store, activeCount = 0, now = new Date()) {
  const limit = Number(store?.limits?.productMonthlyLimit) || 50;
  const used = Math.max(0, Number(activeCount) || 0);
  const base = { limit, used, remaining: Math.max(0, limit - used) };
  if (!store) return { ...base, allowed: false, reason: "no_store", message: "Your store could not be loaded." };
  if (store.removalStatus === "pending_deletion") {
    return { ...base, allowed: false, reason: "removal_hold", message: "Your store is being removed, so you can't add or switch on items." };
  }
  let current = true;
  if (store.isActive === false) current = false;
  else if (store.subscription) {
    const { status, expiresAt } = store.subscription;
    const ends = expiresAt ? new Date(expiresAt) : null;
    current = (status === "active" || status === "trial") && !(ends && !Number.isNaN(ends.getTime()) && ends <= now);
  }
  if (!current) {
    return { ...base, allowed: false, reason: "plan_ended", message: "Your plan has ended. Renew it to add items or switch them back on." };
  }
  if (used >= limit) {
    return { ...base, allowed: false, reason: "quota_full", message: `You've used all ${limit} items on your plan. Switch off an item or move to a bigger plan to add more.` };
  }
  return { ...base, allowed: true, reason: "", message: "" };
}

/** Matches lines in a plan's free-text feature list that restate its item or photo limits. */
const LIMIT_LINE = /\d+\s*(catalog\s+)?(products?|items?|photos?|images?|listings?)\b/i;

/**
 * Feature lines for a plan card. The item and photo lines are generated from the plan's
 * numbers so they can't disagree with the limits; free-text lines that restate a limit are dropped.
 */
export function planFeatureLines(plan) {
  if (!plan) return [];
  const lines = [];
  const items = Number(plan.productMonthlyLimit) || 0;
  const photos = Number(plan.maxImagesPerProduct) || 0;
  if (items > 0) lines.push(`Up to ${items} active ${items === 1 ? "item" : "items"} in your store`);
  if (photos > 0) lines.push(`Up to ${photos} ${photos === 1 ? "photo" : "photos"} per item`);
  const extra = Array.isArray(plan.extraFeatures) ? plan.extraFeatures : Array.isArray(plan.features) ? plan.features : [];
  for (const line of extra) {
    if (typeof line === "string" && line.trim() && !LIMIT_LINE.test(line)) lines.push(line.trim());
  }
  return lines;
}

/** Price as shown in lists: "₹999 / kg". */
export function formatItemPrice(product) {
  const p = product?.price && typeof product.price === "object" ? product.price : null;
  const amount = Number(p ? p.min : product?.price) || 0;
  const unit = p?.unit || product?.unit || "";
  return `₹${amount.toLocaleString("en-IN")}${unit ? ` / ${unit}` : ""}`;
}

export function formatRupees(value) {
  const n = Number(value) || 0;
  return n === 0 ? "Free" : `₹${n.toLocaleString("en-IN")}`;
}

const PHONE = /^\+?[0-9]{10,15}$/;

/** Profile form state from a store record. */
export function storeToProfileForm(store) {
  return {
    storeName: store?.storeName || "",
    description: store?.description || "",
    entityType: normaliseEntityType(store?.entityType),
    phone: store?.contact?.phone || "",
    whatsapp: store?.contact?.whatsapp || "",
    area: store?.address?.area || "",
    city: store?.address?.city || store?.city || "",
    state: store?.address?.state || store?.state || "",
    metadata: store?.metadata && typeof store.metadata === "object" ? store.metadata : {},
  };
}

/** Field errors for the store profile, using the same rules the server applies. */
export function validateProfileForm(form) {
  const errors = {};
  if (!String(form.storeName || "").trim()) errors.storeName = "Enter your store name.";
  const phone = String(form.phone || "").replace(/[\s-]/g, "");
  if (phone && !PHONE.test(phone)) errors.phone = "Enter 10 to 15 digits, with an optional + at the start.";
  const wa = String(form.whatsapp || "").replace(/[\s-]/g, "");
  if (!wa) errors.whatsapp = "Enter the WhatsApp number customers should message.";
  else if (!PHONE.test(wa)) errors.whatsapp = "Enter 10 to 15 digits, with an optional + at the start.";
  return errors;
}

export function buildProfilePayload(form) {
  return {
    storeName: String(form.storeName || "").trim(),
    description: String(form.description || "").trim(),
    entityType: normaliseEntityType(form.entityType),
    contact: { phone: String(form.phone || "").trim(), whatsapp: String(form.whatsapp || "").trim() },
    address: { area: String(form.area || "").trim(), city: String(form.city || "").trim(), state: String(form.state || "").trim() },
    metadata: form.metadata || {},
  };
}

/** Maps a server validation message from the profile route to the field it is about. */
export function profileErrorField(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("store name")) return "storeName";
  if (m.includes("whatsapp")) return "whatsapp";
  if (m.includes("phone")) return "phone";
  if (m.includes("entitytype")) return "entityType";
  if (m.includes("description")) return "description";
  return null;
}

/** Field errors from a server message on the item routes. */
export function productErrorField(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("product name")) return "productName";
  if (m.includes("maximum price")) return "mrp";
  if (m.includes("price")) return "price";
  if (m.includes("image") || m.includes("photo")) return "images";
  return null;
}

/**
 * Getting-started steps for a new store, worked out from data already on record.
 * Sharing leaves no record, so the caller passes whether the link was copied or the QR opened.
 */
export function getGettingStarted(store, products = [], { shared = false } = {}) {
  const profileDone = Boolean(
    String(store?.storeName || "").trim() &&
      String(store?.description || "").trim() &&
      String(store?.contact?.whatsapp || "").trim() &&
      String(store?.address?.city || store?.city || "").trim()
  );
  const steps = [
    { key: "profile", label: "Complete your store profile", hint: "Add a description, your WhatsApp number and your city.", done: profileDone, to: "/vendor/store" },
    { key: "item", label: "Add your first item", hint: "Customers can only enquire about items you list.", done: products.length > 0, to: "/vendor/items/new" },
    { key: "share", label: "Share your store link", hint: "Copy the link or print the QR code for your counter.", done: Boolean(shared), to: null },
  ];
  return { steps, done: steps.filter((s) => s.done).length, complete: steps.every((s) => s.done) };
}
