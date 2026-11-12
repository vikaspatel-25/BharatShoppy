import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMemoryDb, createMockRes } from "./helpers/memoryDb.js";
import { listListings, hideListing, restoreListing } from "../src/controllers/adminListingController.js";
import { getProductPage } from "../src/controllers/productPageController.js";
import { getStorePage } from "../src/controllers/storePageController.js";
import { searchStoreProducts } from "../src/controllers/storeProductSearchController.js";
import { globalSearch } from "../src/controllers/globalSearchController.js";
import { getProducts } from "../src/controllers/productController.js";
import { updateVendorProduct, getVendorDashboardData } from "../src/controllers/vendorCatalogController.js";
import { filterProductsByActiveStores, isProductPubliclyVisible } from "../src/services/catalogVisibility.js";
import { setTestTransport, resetTestTransport } from "../src/services/emailService.js";
import { resetInMemoryVendors } from "../src/controllers/vendorAuthController.js";

const DAY = 86400000;
const adminReq = (extra = {}) => ({
  admin: { adminId: "admin_1", email: "admin@example.com", role: "admin" },
  ip: "203.0.113.9",
  headers: {},
  query: {},
  params: {},
  body: {},
  ...extra,
});

function seed() {
  return {
    stores: [
      {
        _id: "s1",
        storeName: "Asha <b>Tailors</b>",
        slug: "asha",
        subdomain: "asha",
        city: "Pune",
        isActive: true,
        subscription: { plan: "yearly_standard", status: "active", expiresAt: new Date(Date.now() + 100 * DAY).toISOString() },
        limits: { productMonthlyLimit: 10, maxImagesPerProduct: 5 },
      },
      { _id: "s2", storeName: "Bala Farms", slug: "bala", subdomain: "bala", city: "Nashik", isActive: true },
    ],
    vendors: [{ _id: "v1", email: "asha@example.com", storeId: "s1", status: "approved" }],
    products: [
      { _id: "p_kurta", storeId: "s1", productName: "Silk Kurta", category: "Clothing", isActive: true, price: { min: 900, max: 900, unit: "piece" }, images: ["https://img/kurta.jpg"], updatedAt: "2026-11-10" },
      { _id: "p_saree", storeId: "s1", productName: "Cotton Saree", category: "Clothing", isActive: true, price: { min: 1200, max: 1200, unit: "piece" }, updatedAt: "2026-11-09" },
      { _id: "p_rice", storeId: "s2", productName: "Basmati Rice", category: "Grains", isActive: true, updatedAt: "2026-11-08" },
    ],
  };
}

describe("P4: listing moderation", () => {
  let prevDb;
  let memDb;
  let sent;

  before(() => {
    prevDb = mongoose.connection.db;
  });
  after(() => {
    mongoose.connection.db = prevDb;
    resetTestTransport();
    resetInMemoryVendors();
  });
  beforeEach(() => {
    sent = [];
    setTestTransport({
      sendMail: async (msg) => {
        sent.push(msg);
        return { messageId: "m" };
      },
    });
    memDb = createMemoryDb(seed());
    mongoose.connection.db = memDb;
  });

  const hide = async (productId, reason = "Photos show a different product") => {
    const res = createMockRes();
    await hideListing(adminReq({ params: { productId }, body: { reason } }), res);
    return res;
  };
  const product = (id) => memDb.collection("products").docs.find((p) => p._id === id);

  it("one rule decides public visibility", () => {
    assert.equal(isProductPubliclyVisible({ isActive: true }), true);
    assert.equal(isProductPubliclyVisible({ isActive: false }), false);
    assert.equal(isProductPubliclyVisible({ isActive: true, moderation: { status: "hidden" } }), false);
    const visible = filterProductsByActiveStores(
      [
        { _id: "a", storeId: "s", isActive: true },
        { _id: "b", storeId: "s", isActive: true, moderation: { status: "hidden" } },
      ],
      [{ _id: "s" }]
    );
    assert.deepEqual(visible.map((p) => p._id), ["a"]);
  });

  it("hiding removes the item from every public place, and restore brings it back", async () => {
    const res = await hide("p_kurta");
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(product("p_kurta").moderation.status, "hidden");

    const page = createMockRes();
    await getProductPage({ params: { productId: "p_kurta" } }, page);
    assert.equal(page.statusCode, 404);

    const storePage = createMockRes();
    await getStorePage({ params: { storeId: "asha" }, query: {} }, storePage);
    assert.equal(storePage.statusCode, 200, JSON.stringify(storePage.body));
    const storeIds = (storePage.body.products || []).map((p) => p._id);
    assert.ok(!storeIds.includes("p_kurta"), "hidden item is not on the store page");
    assert.ok(storeIds.includes("p_saree"));

    const storeSearch = createMockRes();
    await searchStoreProducts({ params: { storeId: "s1" }, query: { q: "kurta" } }, storeSearch);
    assert.equal((storeSearch.body.products || []).length, 0);

    const global = createMockRes();
    await globalSearch({ query: { q: "kurta" } }, global);
    assert.ok(!(global.body.products || []).some((p) => p._id === "p_kurta"));

    const feed = createMockRes();
    await getProducts({ query: {} }, feed);
    assert.ok(!(feed.body.products || []).some((p) => p._id === "p_kurta"));
    assert.ok((feed.body.products || []).some((p) => p._id === "p_saree"));

    const restore = createMockRes();
    await restoreListing(adminReq({ params: { productId: "p_kurta" } }), restore);
    assert.equal(restore.statusCode, 200);
    assert.equal(product("p_kurta").moderation, undefined);

    const pageAgain = createMockRes();
    await getProductPage({ params: { productId: "p_kurta" } }, pageAgain);
    assert.equal(pageAgain.statusCode, 200);
  });

  it("a vendor can't clear the hidden state by editing or reactivating", async () => {
    await hide("p_kurta");
    const store = structuredClone(memDb.collection("stores").docs[0]);
    const res = createMockRes();
    await updateVendorProduct(
      { params: { storeId: "s1", productId: "p_kurta" }, store, body: { productName: "Silk Kurta (new)", isActive: true, moderation: null } },
      res
    );
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(product("p_kurta").productName, "Silk Kurta (new)");
    assert.equal(product("p_kurta").moderation.status, "hidden");

    const dash = createMockRes();
    await getVendorDashboardData({ params: { storeId: "s1" }, store }, dash);
    const item = dash.body.products.find((p) => p._id === "p_kurta");
    assert.equal(item.moderation.reason, "Photos show a different product", "the vendor sees the reason");
    assert.equal(item.moderation.hiddenBy, undefined, "no admin details reach the vendor");
  });

  it("requires a reason of 5 to 500 characters", async () => {
    assert.equal((await hide("p_kurta", "")).statusCode, 400);
    assert.equal((await hide("p_kurta", "bad")).statusCode, 400);
    assert.equal((await hide("p_kurta", "x".repeat(501))).statusCode, 400);
    const notString = createMockRes();
    await hideListing(adminReq({ params: { productId: "p_kurta" }, body: { reason: { $gt: "" } } }), notString);
    assert.equal(notString.statusCode, 400);
    assert.equal(product("p_kurta").moderation, undefined);
  });

  it("hiding twice or restoring a visible item returns 409", async () => {
    await hide("p_kurta");
    assert.equal((await hide("p_kurta")).statusCode, 409);
    const res = createMockRes();
    await restoreListing(adminReq({ params: { productId: "p_saree" } }), res);
    assert.equal(res.statusCode, 409);
  });

  it("unknown and malformed item IDs are refused", async () => {
    assert.equal((await hide("nope_123")).statusCode, 404);
    assert.equal((await hide("bad id with spaces")).statusCode, 400);
  });

  it("emails the vendor with the item and reason escaped", async () => {
    await hide("p_kurta", "Uses <script>alert(1)</script> in the title");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "asha@example.com");
    assert.ok(sent[0].html.includes("&lt;script&gt;"));
    assert.ok(!sent[0].html.includes("<script>"));
    assert.ok(sent[0].html.includes("Asha &lt;b&gt;Tailors&lt;/b&gt;"));
  });

  it("a failed email keeps the change and returns a warning", async () => {
    setTestTransport({
      sendMail: async () => {
        throw new Error("SMTP down");
      },
    });
    const res = await hide("p_kurta");
    assert.equal(res.statusCode, 200);
    assert.match(res.body.warning, /could not be sent/);
    assert.equal(product("p_kurta").moderation.status, "hidden");
  });

  it("each action writes one audit entry", async () => {
    await hide("p_kurta");
    const res = createMockRes();
    await restoreListing(adminReq({ params: { productId: "p_kurta" } }), res);
    const log = memDb.collection("admin_audit_log").docs;
    assert.deepEqual(log.map((e) => e.action), ["listing.hide", "listing.restore"]);
    assert.equal(log[0].targetId, "p_kurta");
    assert.equal(log[0].details.reason, "Photos show a different product");
  });

  it("lists items with store names, filters and paging", async () => {
    await hide("p_rice");
    const all = createMockRes();
    await listListings(adminReq(), all);
    assert.equal(all.body.total, 3);
    const rice = all.body.listings.find((l) => l.productId === "p_rice");
    assert.equal(rice.storeName, "Bala Farms");
    assert.equal(rice.hidden, true);

    const hidden = createMockRes();
    await listListings(adminReq({ query: { state: "hidden" } }), hidden);
    assert.deepEqual(hidden.body.listings.map((l) => l.productId), ["p_rice"]);

    const visible = createMockRes();
    await listListings(adminReq({ query: { state: "visible" } }), visible);
    assert.equal(visible.body.total, 2);

    const byStore = createMockRes();
    await listListings(adminReq({ query: { storeId: "s2" } }), byStore);
    assert.deepEqual(byStore.body.listings.map((l) => l.productId), ["p_rice"]);

    const byStoreName = createMockRes();
    await listListings(adminReq({ query: { search: "bala" } }), byStoreName);
    assert.deepEqual(byStoreName.body.listings.map((l) => l.productId), ["p_rice"]);

    const byItemName = createMockRes();
    await listListings(adminReq({ query: { search: "saree" } }), byItemName);
    assert.deepEqual(byItemName.body.listings.map((l) => l.productId), ["p_saree"]);

    const paged = createMockRes();
    await listListings(adminReq({ query: { limit: "1", skip: "1" } }), paged);
    assert.equal(paged.body.listings.length, 1);
    assert.equal(paged.body.total, 3);

    const badState = createMockRes();
    await listListings(adminReq({ query: { state: "gone" } }), badState);
    assert.equal(badState.statusCode, 400);
  });
});
