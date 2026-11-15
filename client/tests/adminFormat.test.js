import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditActionLabel,
  computeNewExpiry,
  conflictMessage,
  countByStatus,
  detailValue,
  humaniseKey,
  isValidDuration,
  matchesApplication,
} from "../src/lib/adminFormat.js";
import { getPanelRoutes } from "../src/routes/panelRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..", "src");
const NOW = new Date("2026-11-15T06:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("P7: plan duration and end date", () => {
  it("accepts whole days from 1 to 366 only", () => {
    for (const ok of [1, "30", 366]) assert.equal(isValidDuration(ok), true, String(ok));
    for (const bad of [0, 367, 1.5, "", "abc", -3]) assert.equal(isValidDuration(bad), false, String(bad));
  });

  it("extends from the current end date when it is later than today", () => {
    const current = new Date(NOW.getTime() + 10 * DAY).toISOString();
    assert.equal(computeNewExpiry(current, 30, NOW).getTime(), NOW.getTime() + 40 * DAY);
  });

  it("starts from today when the plan has ended or there is none", () => {
    const past = new Date(NOW.getTime() - 5 * DAY).toISOString();
    assert.equal(computeNewExpiry(past, 30, NOW).getTime(), NOW.getTime() + 30 * DAY);
    assert.equal(computeNewExpiry(null, 30, NOW).getTime(), NOW.getTime() + 30 * DAY);
    assert.equal(computeNewExpiry(null, 0, NOW), null);
  });
});

describe("P7: 409 wording", () => {
  it("names the three cases plainly", () => {
    assert.match(conflictMessage("Cannot renew subscription: store is pending removal."), /being removed/);
    assert.match(conflictMessage("Failed to renew subscription atomically due to concurrent update. Please retry."), /Someone else changed/);
    assert.match(conflictMessage("Application was already processed or is no longer pending."), /already decided/);
    assert.match(conflictMessage("Cannot approve request with status 'approved'. Only pending requests can be processed."), /already decided/);
    assert.match(conflictMessage("Vendor is already marked for removal."), /already decided/);
  });

  it("keeps the server's text for slug and email clashes", () => {
    const msg = "A store with slug 'vastra' or subdomain 'vastra' already exists.";
    assert.equal(conflictMessage(msg), msg);
  });
});

describe("P7: audit log labels and details", () => {
  it("gives every logged action a readable label", () => {
    assert.equal(auditActionLabel("store.renew").label, "Set or renewed plan");
    assert.equal(auditActionLabel("listing.hide").tone, "warn");
    assert.equal(auditActionLabel("something.new").label, "something new");
  });

  it("renders details as text, never raw JSON", () => {
    assert.equal(humaniseKey("durationDays"), "Duration days");
    assert.equal(detailValue(true), "Yes");
    assert.equal(detailValue(["a", "b"]), "a, b");
    const nested = detailValue({ planId: "x", emailFailed: false });
    assert.equal(nested, "Plan id: x; Email failed: No");
    assert.ok(!nested.includes("{"));
  });
});

describe("P7: applications search and counts", () => {
  it("searches name, store, email, phone, address and city", () => {
    const app = { name: "Asha", storeName: "Vastra", email: "a@x.in", phone: "+91987", slug: "vastra", address: { city: "Pune" } };
    for (const q of ["asha", "VASTRA", "a@x", "987", "pune", ""]) assert.equal(matchesApplication(app, q), true, q);
    assert.equal(matchesApplication(app, "delhi"), false);
  });

  it("counts by status", () => {
    const c = countByStatus([{ status: "pending" }, { status: "pending" }, { status: "rejected" }], ["pending", "approved", "rejected"]);
    assert.deepEqual(c, { all: 3, pending: 2, approved: 0, rejected: 1 });
  });
});

describe("P7: no browser dialogs and no old admin page", () => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const files = walk(srcRoot).filter((f) => /\.(jsx?|tsx?)$/.test(f));

  it("client/src uses no window.prompt, window.confirm or alert(", () => {
    for (const f of files) {
      const c = fs.readFileSync(f, "utf-8");
      assert.ok(!/window\.(prompt|confirm|alert)\s*\(|\balert\(/.test(c), path.relative(srcRoot, f));
    }
  });

  it("nothing imports the deleted AdminDashboard.jsx", () => {
    assert.equal(fs.existsSync(path.join(srcRoot, "pages", "AdminDashboard.jsx")), false);
    for (const f of files) assert.ok(!fs.readFileSync(f, "utf-8").includes("AdminDashboard.jsx"), path.relative(srcRoot, f));
  });

  it("tenant hosts serve no admin page", () => {
    assert.deepEqual(getPanelRoutes({ tenant: "vastra" }).admin, []);
  });
});
