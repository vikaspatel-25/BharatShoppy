/**
 * Sample data for trying the site and both panels before real vendors join:
 * 10 shops (with vendor records), 10 items, 2 vendor applications and 1 plan request.
 *
 * Every record is tagged `sampleTag: "sample-2026-11"` and has an ID starting `sample_`,
 * so `--remove` deletes exactly what `--insert` added and nothing else.
 * Vendor emails are @example.com, so no real person can sign in as them or get email.
 *
 * Usage, from server/ with MONGO_URI in server/.env:
 *   node scripts/sampleData.js             dry run: shows the target database and what would change
 *   node scripts/sampleData.js --insert    adds the sample data; existing records are never overwritten
 *   node scripts/sampleData.js --remove    deletes every record carrying the sample tag
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(__filename), "..");

export const SAMPLE_TAG = "sample-2026-11";
const DAY = 86400000;

const PLANS = {
  starter_free: { name: "Starter Trial Plan", items: 15, photos: 5, price: 0 },
  yearly_standard: { name: "Boutique & Farm Standard", items: 50, photos: 8, price: 1200 },
  yearly_pro: { name: "Enterprise & Agri-Hub Pro", items: 200, photos: 12, price: 2400 },
};

const SHOPS = [
  // slug, name, entityType, category, city, state, lat, lng, plan, status, days left (negative = ended), description
  ["vastra", "Vastra Handloom House", "shopkeeper", "Apparel & Fashion", "Jaipur", "Rajasthan", 26.92, 75.82, "yearly_standard", "active", 20, "Hand-block printed cotton kurtis, sarees and home linen from Jaipur's printing families."],
  ["green-valley", "Green Valley Farms", "farmer", "Groceries & Organics", "Nashik", "Maharashtra", 20.01, 73.79, "yearly_pro", "active", 300, "Grapes, onions and seasonal vegetables picked to order from our farm."],
  ["sharma-electricals", "Sharma Electricals", "service_provider", "Services & Repairs", "Indore", "Madhya Pradesh", 22.72, 75.86, "starter_free", "expired", -12, "Home wiring, inverter installation and appliance repairs."],
  ["old-town-sweets", "Old Town Sweets", "shopkeeper", "Groceries & Organics", "Lucknow", "Uttar Pradesh", 26.85, 80.95, "starter_free", "removal_hold", 5, "Traditional mithai and namkeen made fresh every morning."],
  ["meenakshi-spices", "Meenakshi Spices", "farmer", "Groceries & Organics", "Madurai", "Tamil Nadu", 9.93, 78.12, "yearly_standard", "active", 9, "Sun-dried chillies, turmeric and masalas ground in small batches."],
  ["kolkata-books", "Kolkata Book Corner", "shopkeeper", "Books & Stationery", "Kolkata", "West Bengal", 22.57, 88.36, "yearly_standard", "active", 180, "New and second-hand books in Bengali, Hindi and English."],
  ["ravi-tailors", "Ravi Tailoring Studio", "service_provider", "Services & Repairs", "Pune", "Maharashtra", 18.52, 73.86, "starter_free", "active", 25, "Alterations, blouse stitching and custom tailoring with home pickup."],
  ["himalayan-apples", "Himalayan Apple Orchards", "farmer", "Groceries & Organics", "Shimla", "Himachal Pradesh", 31.1, 77.17, "yearly_pro", "expired", -40, "Royal Delicious and Golden apples straight from the orchard."],
  ["coastal-cane", "Coastal Cane Furniture", "shopkeeper", "Furniture & Home Decor", "Kochi", "Kerala", 9.93, 76.27, "yearly_pro", "active", 240, "Handwoven cane chairs, swings and baskets made by local artisans."],
  ["anand-dairy", "Anand Dairy Fresh", "farmer", "Groceries & Organics", "Anand", "Gujarat", 22.56, 72.95, null, "none", null, "Fresh milk, paneer and ghee from our village dairy."],
];

const ITEMS = [
  // shop slug, name, category, min, max, unit, extra
  ["vastra", "Hand-block printed cotton kurti, indigo", "Apparel & Fashion", 899, 1199, "piece", {}],
  ["vastra", "Sanganeri print cotton saree with blouse piece", "Apparel & Fashion", 2499, 2499, "piece", { inStock: false }],
  ["vastra", "Bagru dabu dupatta", "Apparel & Fashion", 650, 650, "piece", { isActive: false }],
  ["vastra", "Kids' cotton frock", "Apparel & Fashion", 450, 450, "piece", { moderation: { status: "hidden", reason: "Sample: the photos show a different product.", hiddenAt: new Date().toISOString() } }],
  ["green-valley", "Thompson seedless grapes", "Groceries & Organics", 90, 120, "kg", {}],
  ["meenakshi-spices", "Guntur red chilli powder", "Groceries & Organics", 280, 320, "kg", {}],
  ["kolkata-books", "Gitanjali, Bengali edition", "Books & Stationery", 250, 250, "piece", {}],
  ["ravi-tailors", "Blouse stitching with lining", "Services & Repairs", 450, 650, "service", {}],
  ["coastal-cane", "Handwoven cane armchair", "Furniture & Home Decor", 6500, 7800, "piece", {}],
  ["himalayan-apples", "Royal Delicious apples, 10 kg box", "Groceries & Organics", 1400, 1600, "box", {}],
];

const iso = (now, days) => new Date(now.getTime() + days * DAY).toISOString();
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hours = { open: "10:00", close: "20:00" };

/** Builds every sample record. Exported for tests; touches no database. */
export function buildSampleData(now = new Date()) {
  const tag = { sampleTag: SAMPLE_TAG };
  const stores = [];
  const vendors = [];
  SHOPS.forEach(([slug, storeName, entityType, storeCategory, city, state, lat, lng, planId, status, days, description], i) => {
    const plan = planId ? PLANS[planId] : null;
    const phone = `+9190000000${String(i + 1).padStart(2, "0")}`;
    const store = {
      _id: `sample_store_${slug}`,
      storeName,
      slug: `sample-${slug}`,
      subdomain: `sample-${slug}`,
      entityType,
      storeCategory,
      description: `${description} (Sample store for testing.)`,
      city,
      state,
      location: { latitude: lat, longitude: lng },
      address: { area: "Main Market", city, state },
      contact: { phone, whatsapp: phone },
      businessHours: Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => [d, hours])),
      metadata: {},
      limits: { productMonthlyLimit: plan ? plan.items : 50, maxImagesPerProduct: plan ? plan.photos : 5 },
      isActive: status !== "removal_hold",
      createdAt: iso(now, -60),
      updatedAt: now.toISOString(),
      ...tag,
    };
    if (plan) {
      store.subscription = {
        plan: planId,
        status: status === "expired" ? "expired" : "active",
        startDate: iso(now, (days ?? 0) - 365),
        expiresAt: iso(now, days),
      };
    }
    if (status === "removal_hold") {
      store.removalStatus = "pending_deletion";
      store.deleteAfter = iso(now, 6);
    }
    stores.push(store);
    vendors.push({
      _id: `sample_vendor_${slug}`,
      email: `sample-${slug}@example.com`,
      name: `${storeName} owner`,
      storeId: store._id,
      status: status === "removal_hold" ? "removed" : "approved",
      createdAt: iso(now, -60),
      ...(status === "removal_hold" ? { deleteAfter: store.deleteAfter } : {}),
      ...tag,
    });
  });

  const products = ITEMS.map(([shop, productName, category, min, max, unit, extra], i) => ({
    _id: `sample_prod_${String(i + 1).padStart(2, "0")}`,
    storeId: `sample_store_${shop}`,
    productName,
    slug: `sample-${slugify(productName)}`,
    shortDescription: `Sample item: ${productName}.`,
    description: `A sample listing for testing how items look. ${productName}.`,
    category,
    images: [],
    price: { min, max, currency: "INR", unit },
    attributes: {},
    tags: ["sample"],
    isActive: true,
    inStock: true,
    createdAt: iso(now, -30 + i),
    updatedAt: now.toISOString(),
    ...extra,
    ...tag,
  }));

  const applications = [
    { _id: "sample_app_meera", email: "sample-meera@example.com", name: "Meera Iyer", storeName: "Meera's Millet Kitchen", slug: "sample-meera-millets", subdomain: "sample-meera-millets", phone: "+919000000101", entityType: "farmer", storeCategory: "Groceries & Organics", description: "Organic millet flours and snacks. (Sample application.)", address: { city: "Mysuru", state: "Karnataka" }, status: "pending", createdAt: iso(now, -0.2), updatedAt: iso(now, -0.2), ...tag },
    { _id: "sample_app_ravi", email: "sample-kiran@example.com", name: "Kiran Patil", storeName: "Kiran Mobile Repairs", slug: "sample-kiran-mobiles", subdomain: "sample-kiran-mobiles", phone: "+919000000102", entityType: "service_provider", storeCategory: "Services & Repairs", description: "Phone screen and battery replacement. (Sample application.)", address: { city: "Nagpur", state: "Maharashtra" }, status: "pending", createdAt: iso(now, -1.5), updatedAt: iso(now, -1.5), ...tag },
  ];

  const requests = [
    { _id: "sample_req_vastra", storeId: "sample_store_vastra", storeName: "Vastra Handloom House", selectedPlan: "yearly_standard", planName: PLANS.yearly_standard.name, originalPrice: 1800, discountedPrice: 1200, billingCycle: "Per Year", productMonthlyLimit: 50, vendorNote: "Sample request: will pay by bank transfer.", status: "pending", createdAt: iso(now, -1), verifiedAt: null, adminNotes: "", ...tag },
  ];

  return { stores, vendors, products, vendor_applications: applications, subscription_requests: requests };
}

/** Adds every sample record that isn't there yet. Never overwrites. Returns counts per collection. */
export async function insertSampleData(db, now = new Date()) {
  const data = buildSampleData(now);
  const result = {};
  for (const [name, docs] of Object.entries(data)) {
    let added = 0;
    for (const doc of docs) {
      const res = await db.collection(name).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
      if (res?.upsertedCount) added += 1;
    }
    result[name] = added;
  }
  return result;
}

/** Deletes every record carrying the sample tag. Returns counts per collection. */
export async function removeSampleData(db) {
  const result = {};
  for (const name of ["stores", "vendors", "products", "vendor_applications", "subscription_requests", "admin_notifications", "admin_audit_log"]) {
    const res = await db.collection(name).deleteMany({ sampleTag: SAMPLE_TAG });
    result[name] = res?.deletedCount || 0;
  }
  // Admin actions on sample records are logged without the tag, so match those by target ID
  const audit = await db.collection("admin_audit_log").deleteMany({ targetId: { $regex: "^sample_" } });
  result.admin_audit_log += audit?.deletedCount || 0;
  return result;
}

async function main() {
  dotenv.config({ path: path.join(serverRoot, ".env") });
  const mode = process.argv.includes("--insert") ? "insert" : process.argv.includes("--remove") ? "remove" : "dry-run";
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing. Add it to server/.env.");

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  try {
    const host = mongoose.connection.host;
    console.log(`Database: ${db.databaseName} on ${host}`);
    if (mode === "dry-run") {
      const data = buildSampleData();
      for (const [name, docs] of Object.entries(data)) {
        const existing = await db.collection(name).countDocuments({ _id: { $in: docs.map((d) => d._id) } });
        console.log(`  ${name}: ${docs.length} sample records, ${existing} already present`);
      }
      const clashes = await db.collection("stores").countDocuments({ slug: { $in: data.stores.map((s) => s.slug) }, sampleTag: { $ne: SAMPLE_TAG } });
      console.log(`  real stores using a sample slug: ${clashes}`);
      console.log("Dry run only. Nothing changed. Use --insert to add or --remove to delete.");
    } else if (mode === "insert") {
      console.log("Added:", await insertSampleData(db));
    } else {
      console.log("Removed:", await removeSampleData(db));
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
