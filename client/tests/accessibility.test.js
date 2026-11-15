import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

describe("L1: Accessibility verification tests", () => {
  it("client/index.html includes meta name='description'", () => {
    const htmlPath = path.join(clientRoot, "index.html");
    const content = fs.readFileSync(htmlPath, "utf-8");
    assert.match(
      content,
      /<meta\s+name=["']description["']\s+content=["'][^"']+["']/i,
      "index.html must contain a meta description tag"
    );
  });

  const read = (...parts) => fs.readFileSync(path.join(clientRoot, "src", ...parts), "utf-8");

  it("store profile uses real radio inputs for the entity type, inside a labelled group", () => {
    const content = read("pages", "vendor", "VendorStore.jsx");
    assert.ok(content.includes('type="radio"'), "Entity picker must use real radio inputs");
    assert.ok(content.includes('name="entityType"'), "Entity radios must share one name");
    assert.ok(content.includes("<fieldset") && content.includes("<legend"), "Entity radios must sit in a fieldset with a legend");
    assert.ok(content.includes("aria-invalid="), "Fields with errors must set aria-invalid");
  });

  it("items list labels its edit and switch buttons with the item name", () => {
    const content = read("pages", "vendor", "VendorItems.jsx");
    assert.ok(content.includes("aria-label={`Edit ${item.productName"), "Edit buttons must have aria-label");
    assert.ok(content.includes("aria-label={`Switch off ${item.productName"), "Switch off buttons must have aria-label");
    assert.ok(content.includes("aria-label={`Switch on ${item.productName"), "Switch on buttons must have aria-label");
    assert.ok(content.includes("<Modal"), "Switching off must be confirmed in the shared dialog");
  });

  it("shared Modal has dialog role, aria-modal, a label and an Escape handler", () => {
    const content = read("components", "panel", "ui.jsx");
    assert.ok(content.includes('role="dialog"'), "Modal must have role='dialog'");
    assert.ok(content.includes('aria-modal="true"'), "Modal must have aria-modal='true'");
    assert.ok(content.includes("aria-label={title}"), "Modal must be labelled by its title");
    assert.ok(content.includes('e.key === "Escape"'), "Modal must handle Escape key press");
  });

  it("item editor labels its photo buttons and uses real radio inputs for the unit", () => {
    const content = read("pages", "vendor", "VendorItemEditor.jsx");
    assert.ok(content.includes("aria-label={`Set image ${idx + 1} as cover photo`}"), "Set cover photo button must have aria-label");
    assert.ok(content.includes("aria-label={`Remove image ${idx + 1}`}"), "Remove photo button must have aria-label");
    assert.ok(content.includes('name="unit"') && content.includes('type="radio"'), "Unit picker must use real radio inputs");
    assert.ok(content.includes("aria-invalid="), "Fields with errors must set aria-invalid");
  });

  it("plan page offers plans as real radio inputs inside a labelled group", () => {
    const content = read("pages", "vendor", "VendorPlan.jsx");
    assert.ok(content.includes('type="radio"') && content.includes('name="plan"'), "Plans must be real radio inputs");
    assert.ok(content.includes("<fieldset") && content.includes("<legend"), "Plans must sit in a fieldset with a legend");
  });

  it("vendor portal files call no admin route and use no browser dialogs", () => {
    const dirs = [path.join(clientRoot, "src", "pages", "vendor"), path.join(clientRoot, "src", "components", "vendor")];
    for (const dir of dirs) {
      for (const file of fs.readdirSync(dir)) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        assert.ok(!content.includes("/api/admin/"), `${file} must not call an admin route`);
        assert.ok(!/window\.(prompt|confirm|alert)\s*\(|\balert\(/.test(content), `${file} must not use browser dialogs`);
      }
    }
  });

  it("storeQrModal.jsx contains dialog role, aria-modal, title link, and escape handler", () => {
    const qrModalPath = path.join(
      clientRoot,
      "src",
      "components",
      "store",
      "storeQrModal.jsx"
    );
    const content = fs.readFileSync(qrModalPath, "utf-8");

    assert.ok(content.includes('role="dialog"'), "QR modal must have role='dialog'");
    assert.ok(
      content.includes('aria-modal="true"'),
      "QR modal must have aria-modal='true'"
    );
    assert.ok(
      content.includes('aria-labelledby="qr-modal-title"'),
      "QR modal must have aria-labelledby='qr-modal-title'"
    );
    assert.ok(
      content.includes('id="qr-modal-title"'),
      "QR modal heading must have id='qr-modal-title'"
    );
    assert.ok(
      content.includes('e.key === "Escape"'),
      "QR modal must handle Escape key press"
    );
  });
});
