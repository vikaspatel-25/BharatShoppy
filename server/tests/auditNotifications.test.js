import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryDb, createMockRes } from "./helpers/memoryDb.js";
import { logAdminAction, buildAuditEntry } from "../src/services/auditLogService.js";
import { createAdminNotification } from "../src/services/notificationService.js";
import { getAuditLog, getNotifications, markNotificationRead } from "../src/controllers/adminActivityController.js";
import {
  verifyPaymentRequest,
  adminDirectRenew,
  adminDirectDiscontinue,
  sendAdminRenewalReminder,
  submitSubscriptionRequest,
} from "../src/controllers/subscriptionController.js";
import { updateVendorProfile } from "../src/controllers/vendorCatalogController.js";
import { resetInMemoryVendors } from "../src/controllers/vendorAuthController.js";
import { setTestTransport, resetTestTransport } from "../src/services/emailService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

describe("P3: audit entries", () => {
  it("drops secret-looking keys and cuts long strings", () => {
    const entry = buildAuditEntry({
      req: adminReq(),
      action: "store.renew",
      targetType: "store",
      targetId: "s1",
      targetName: "Asha",
      details: {
        code: "123456",
        otpHash: "x",
        sessionToken: "t",
        password: "p",
        note: "a".repeat(800),
        nested: { apiSecret: "s", ok: 1 },
      },
    });
    assert.equal(entry.details.code, undefined);
    assert.equal(entry.details.otpHash, undefined);
    assert.equal(entry.details.sessionToken, undefined);
    assert.equal(entry.details.password, undefined);
    assert.equal(entry.details.nested.apiSecret, undefined);
    assert.equal(entry.details.nested.ok, 1);
    assert.ok(entry.details.note.length <= 501);
    assert.equal(entry.actorEmail, "admin@example.com");
    assert.equal(entry.ipAddress, "203.0.113.9");
  });

  it("a logging failure never throws", async () => {
    const prev = mongoose.connection.db;
    mongoose.connection.db = {
      collection() {
        return {
          insertOne: async () => {
            throw new Error("disk full");
          },
        };
      },
    };
    try {
      const result = await logAdminAction({ req: adminReq(), action: "x", targetType: "store" });
      assert.equal(result, null);
    } finally {
      mongoose.connection.db = prev;
    }
  });
});

describe("P3: admin actions write the audit log", () => {
  let prevDb;
  let memDb;

  before(() => {
    prevDb = mongoose.connection.db;
    setTestTransport({ sendMail: async () => ({ messageId: "m" }) });
  });
  after(() => {
    mongoose.connection.db = prevDb;
    resetTestTransport();
    resetInMemoryVendors();
  });
  beforeEach(() => {
    resetInMemoryVendors();
    memDb = createMemoryDb({
      stores: [
        {
          _id: "s1",
          storeName: "Asha Tailors",
          slug: "asha",
          subdomain: "asha",
          contact: { email: "asha@example.com" },
          subscription: { plan: "starter_free", status: "active", expiresAt: new Date(Date.now() + 10 * DAY).toISOString() },
          isActive: true,
        },
      ],
      vendors: [{ _id: "v1", email: "asha@example.com", storeId: "s1", status: "approved" }],
      subscription_requests: [
        { _id: "r1", storeId: "s1", storeName: "Asha Tailors", selectedPlan: "yearly_standard", planName: "Boutique & Farm Standard", status: "pending", createdAt: new Date().toISOString() },
        { _id: "r2", storeId: "s1", storeName: "Asha Tailors", selectedPlan: "yearly_standard", status: "pending", createdAt: new Date().toISOString() },
      ],
      products: [],
    });
    mongoose.connection.db = memDb;
  });

  const log = () => memDb.collection("admin_audit_log").docs;

  it("approving a plan request logs one entry", async () => {
    const res = createMockRes();
    await verifyPaymentRequest(adminReq({ params: { requestId: "r1" }, body: { action: "approve", durationDays: 30 } }), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(log().length, 1);
    assert.equal(log()[0].action, "plan_request.approve");
    assert.equal(log()[0].targetId, "s1");
    assert.equal(log()[0].details.durationDays, 30);
  });

  it("rejecting a plan request logs one entry with the reason", async () => {
    const res = createMockRes();
    await verifyPaymentRequest(adminReq({ params: { requestId: "r2" }, body: { action: "reject", adminNotes: "No payment yet" } }), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(log().length, 1);
    assert.equal(log()[0].action, "plan_request.reject");
    assert.equal(log()[0].details.reason, "No payment yet");
  });

  it("a failed action logs nothing", async () => {
    await verifyPaymentRequest(adminReq({ params: { requestId: "r1" }, body: { action: "approve", durationDays: 30 } }), createMockRes());
    const second = createMockRes();
    await verifyPaymentRequest(adminReq({ params: { requestId: "r1" }, body: { action: "approve", durationDays: 30 } }), second);
    assert.equal(second.statusCode, 409);
    assert.equal(log().length, 1, "the refused second approval adds no entry");

    const bad = createMockRes();
    await adminDirectRenew(adminReq({ params: { storeId: "s1" }, body: { planId: "nope", durationDays: 30 } }), bad);
    assert.equal(bad.statusCode, 400);
    assert.equal(log().length, 1);
  });

  it("renew, reminder and discontinue each log an entry", async () => {
    const renew = createMockRes();
    await adminDirectRenew(adminReq({ params: { storeId: "s1" }, body: { planId: "yearly_standard", durationDays: 365 } }), renew);
    assert.equal(renew.statusCode, 200, JSON.stringify(renew.body));
    const remind = createMockRes();
    await sendAdminRenewalReminder(adminReq({ params: { storeId: "s1" } }), remind);
    assert.equal(remind.statusCode, 200, JSON.stringify(remind.body));
    const end = createMockRes();
    await adminDirectDiscontinue(adminReq({ params: { storeId: "s1" } }), end);
    assert.equal(end.statusCode, 200, JSON.stringify(end.body));
    assert.deepEqual(
      log().map((e) => e.action),
      ["store.renew", "store.renewal_reminder", "store.discontinue"]
    );
  });

  it("a plan request and a store rename notify the admin; an unchanged name doesn't", async () => {
    // A copy, as requireStoreOwner loads one per request
    const store = structuredClone(memDb.collection("stores").docs[0]);
    memDb.collection("subscription_requests").docs = [];
    const res = createMockRes();
    await submitSubscriptionRequest({ params: { storeId: "s1" }, store, body: { planId: "yearly_standard" } }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));

    const rename = createMockRes();
    await updateVendorProfile({ params: { storeId: "s1" }, store, body: { storeName: "Asha Boutique" } }, rename);
    assert.equal(rename.statusCode, 200, JSON.stringify(rename.body));

    const same = createMockRes();
    await updateVendorProfile({ params: { storeId: "s1" }, store: { ...store, storeName: "Asha Boutique" }, body: { storeName: "Asha Boutique" } }, same);
    assert.equal(same.statusCode, 200);

    const notes = memDb.collection("admin_notifications").docs;
    assert.deepEqual(notes.map((n) => n.type).sort(), ["plan_request", "store_renamed"]);
    assert.equal(notes.find((n) => n.type === "plan_request").link, "/admin/plan-requests");
  });
});

describe("P3: application and removal handlers log and notify", () => {
  it("call the audit log and notifications at their success points", () => {
    const appSrc = fs.readFileSync(path.join(__dirname, "../src/controllers/vendorApplicationController.js"), "utf8");
    assert.match(appSrc, /action: "application\.approve"/);
    assert.match(appSrc, /action: "application\.reject"/);
    assert.match(appSrc, /type: "new_application"/);
    const remSrc = fs.readFileSync(path.join(__dirname, "../src/controllers/adminVendorRemovalController.js"), "utf8");
    assert.match(remSrc, /action: "vendor\.remove"/);
    assert.match(remSrc, /action: "vendor\.cancel_removal"/);
  });
});

describe("P3: audit log and notification routes", () => {
  let prevDb;
  before(() => {
    prevDb = mongoose.connection.db;
  });
  after(() => {
    mongoose.connection.db = prevDb;
  });
  beforeEach(() => {
    mongoose.connection.db = createMemoryDb({});
  });

  it("pages and filters the audit log, newest first", async () => {
    for (let i = 0; i < 30; i++) {
      await logAdminAction({
        req: adminReq(),
        action: i % 3 === 0 ? "store.renew" : "application.approve",
        targetType: i % 3 === 0 ? "store" : "application",
        targetName: i === 7 ? "Kisan Farms" : `Store ${i}`,
        now: new Date(Date.UTC(2026, 10, 1, 0, i)),
      });
    }
    const page1 = createMockRes();
    await getAuditLog(adminReq({ query: { limit: "10" } }), page1);
    assert.equal(page1.body.total, 30);
    assert.equal(page1.body.entries.length, 10);
    assert.equal(page1.body.totalPages, 3);
    assert.ok(page1.body.entries[0].createdAt > page1.body.entries[9].createdAt);

    const renewals = createMockRes();
    await getAuditLog(adminReq({ query: { action: "store.renew" } }), renewals);
    assert.equal(renewals.body.total, 10);

    const search = createMockRes();
    await getAuditLog(adminReq({ query: { search: "kisan" } }), search);
    assert.equal(search.body.total, 1);

    const capped = createMockRes();
    await getAuditLog(adminReq({ query: { limit: "9999" } }), capped);
    assert.equal(capped.body.limit, 100);
  });

  it("lists notifications with the unread count, marks one and all read", async () => {
    const a = await createAdminNotification({ type: "new_application", title: "A", message: "a", now: new Date(Date.UTC(2026, 10, 1)) });
    await createAdminNotification({ type: "plan_request", title: "B", message: "b", now: new Date(Date.UTC(2026, 10, 2)) });
    await createAdminNotification({ type: "store_renamed", title: "C", message: "c", now: new Date(Date.UTC(2026, 10, 3)) });
    assert.equal(await createAdminNotification({ type: "bogus", title: "x", message: "x" }), null, "an unknown type is refused without throwing");

    const list = createMockRes();
    await getNotifications(adminReq(), list);
    assert.equal(list.body.notifications.length, 3);
    assert.equal(list.body.unreadCount, 3);
    assert.equal(list.body.notifications[0].title, "C");

    const one = createMockRes();
    await markNotificationRead(adminReq({ body: { id: a._id } }), one);
    assert.equal(one.statusCode, 200);
    const afterOne = createMockRes();
    await getNotifications(adminReq(), afterOne);
    assert.equal(afterOne.body.unreadCount, 2);

    const all = createMockRes();
    await markNotificationRead(adminReq({ body: { all: true } }), all);
    assert.equal(all.body.changed, 2);

    const bad = createMockRes();
    await markNotificationRead(adminReq({ body: { id: { $ne: null } } }), bad);
    assert.equal(bad.statusCode, 400);
    const missing = createMockRes();
    await markNotificationRead(adminReq({ body: { id: "ntf_missing" } }), missing);
    assert.equal(missing.statusCode, 404);
  });

  it("a notification failure doesn't throw", async () => {
    mongoose.connection.db = {
      collection() {
        return {
          insertOne: async () => {
            throw new Error("down");
          },
        };
      },
    };
    const result = await createAdminNotification({ type: "system", title: "t", message: "m" });
    assert.equal(result, null);
  });
});
