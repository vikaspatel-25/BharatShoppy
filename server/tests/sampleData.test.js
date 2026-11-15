import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMemoryDb } from "./helpers/memoryDb.js";
import { SAMPLE_TAG, buildSampleData, insertSampleData, removeSampleData } from "../scripts/sampleData.js";
import { getSubscriptionState } from "../src/services/subscriptionStatus.js";
import { filterProductsByActiveStores } from "../src/services/catalogVisibility.js";

describe("sample data script", () => {
  it("builds 10 shops, 10 items, 2 applications and 1 plan request, all tagged", () => {
    const d = buildSampleData();
    assert.equal(d.stores.length, 10);
    assert.equal(d.vendors.length, 10);
    assert.equal(d.products.length, 10);
    assert.equal(d.vendor_applications.length, 2);
    assert.equal(d.subscription_requests.length, 1);
    for (const docs of Object.values(d)) {
      for (const doc of docs) {
        assert.equal(doc.sampleTag, SAMPLE_TAG);
        assert.ok(String(doc._id).startsWith("sample_"));
      }
    }
    for (const v of d.vendors) assert.match(v.email, /@example\.com$/);
    for (const p of d.products) assert.ok(d.stores.some((s) => s._id === p.storeId), `${p._id} belongs to a sample store`);
  });

  it("covers every plan status the panels show", () => {
    const now = new Date();
    const statuses = new Set(buildSampleData(now).stores.map((s) => getSubscriptionState(s, now).computedStatus));
    assert.deepEqual([...statuses].sort(), ["active", "expired", "none", "removal_hold"]);
  });

  it("shows only items of current stores to the public", () => {
    const d = buildSampleData();
    const visible = filterProductsByActiveStores(d.products, d.stores).map((p) => p.productName);
    assert.ok(visible.includes("Thompson seedless grapes"));
    assert.ok(!visible.includes("Royal Delicious apples, 10 kg box"), "ended plan hides items");
    assert.ok(!visible.includes("Bagru dabu dupatta"), "switched-off item hidden");
    assert.ok(!visible.includes("Kids' cotton frock"), "admin-hidden item hidden");
  });

  it("inserts once, never overwrites, and removes only tagged records", async () => {
    const db = createMemoryDb({ stores: [{ _id: "real_store", storeName: "Real", slug: "real" }], products: [{ _id: "real_prod", storeId: "real_store" }] });
    const first = await insertSampleData(db);
    assert.equal(first.stores, 10);
    assert.equal(first.products, 10);

    db.collection("stores").docs.find((s) => s._id === "sample_store_vastra").storeName = "Edited on the site";
    const second = await insertSampleData(db);
    assert.ok(Object.values(second).every((n) => n === 0), "a second run adds nothing");
    assert.equal(db.collection("stores").docs.find((s) => s._id === "sample_store_vastra").storeName, "Edited on the site", "existing records aren't overwritten");

    db.collection("admin_audit_log").docs.push({ _id: "a1", targetId: "sample_store_vastra" }, { _id: "a2", targetId: "real_store" });
    const removed = await removeSampleData(db);
    assert.equal(removed.stores, 10);
    assert.equal(removed.products, 10);
    assert.equal(removed.admin_audit_log, 1);
    assert.deepEqual(db.collection("stores").docs.map((s) => s._id), ["real_store"]);
    assert.deepEqual(db.collection("products").docs.map((p) => p._id), ["real_prod"]);
    assert.deepEqual(db.collection("admin_audit_log").docs.map((a) => a._id), ["a2"]);
  });
});
