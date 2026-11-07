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

  it("vendorDashboard.jsx contains accessible entity radio buttons and labeled action buttons", () => {
    const vendorDashboardPath = path.join(
      clientRoot,
      "src",
      "pages",
      "vendorDashboard.jsx"
    );
    const content = fs.readFileSync(vendorDashboardPath, "utf-8");

    // Radiogroup for entity type
    assert.ok(
      content.includes('role="radiogroup"'),
      "Entity picker must have role='radiogroup'"
    );
    assert.ok(
      content.includes('role="radio"'),
      "Entity cards must have role='radio'"
    );
    assert.ok(
      content.includes("aria-checked="),
      "Entity radio cards must have aria-checked"
    );

    // Labeled buttons
    assert.ok(
      content.includes('aria-label="Back to Marketplace"'),
      "Back to marketplace link must have aria-label"
    );
    assert.ok(
      content.includes("aria-label={`Edit ${item.productName"),
      "Edit product buttons must have aria-label"
    );
    assert.ok(
      content.includes("aria-label={`Toggle status for ${item.productName"),
      "Toggle status buttons must have aria-label"
    );
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

  it("productUploadModal.jsx contains dialog role, aria-modal, title link, escape handler, and labeled photo buttons", () => {
    const uploadModalPath = path.join(
      clientRoot,
      "src",
      "components",
      "vendor",
      "productUploadModal.jsx"
    );
    const content = fs.readFileSync(uploadModalPath, "utf-8");

    assert.ok(
      content.includes('role="dialog"'),
      "Upload modal must have role='dialog'"
    );
    assert.ok(
      content.includes('aria-modal="true"'),
      "Upload modal must have aria-modal='true'"
    );
    assert.ok(
      content.includes('aria-labelledby="product-upload-title"'),
      "Upload modal must have aria-labelledby='product-upload-title'"
    );
    assert.ok(
      content.includes('id="product-upload-title"'),
      "Upload modal heading must have id='product-upload-title'"
    );
    assert.ok(
      content.includes('e.key === "Escape"'),
      "Upload modal must handle Escape key press"
    );
    assert.ok(
      content.includes("aria-label={`Set image ${idx + 1} as cover photo`}"),
      "Set cover photo button must have aria-label"
    );
    assert.ok(
      content.includes("aria-label={`Remove image ${idx + 1}`}"),
      "Remove photo button must have aria-label"
    );
  });

  it("subscriptionManager.jsx contains dialog role, escape handler, and radiogroup attributes", () => {
    const subManagerPath = path.join(
      clientRoot,
      "src",
      "components",
      "vendor",
      "subscriptionManager.jsx"
    );
    const content = fs.readFileSync(subManagerPath, "utf-8");

    assert.ok(
      content.includes('role="radiogroup"'),
      "Plans container must have role='radiogroup'"
    );
    assert.ok(
      content.includes('role="radio"'),
      "Plans must have role='radio'"
    );
    assert.ok(
      content.includes('role="dialog"'),
      "Request modal must have role='dialog'"
    );
    assert.ok(
      content.includes('aria-modal="true"'),
      "Request modal must have aria-modal='true'"
    );
    assert.ok(
      content.includes('aria-labelledby="activation-modal-title"'),
      "Request modal must have aria-labelledby"
    );
    assert.ok(
      content.includes('e.key === "Escape"'),
      "Request modal must handle Escape key press"
    );
  });
});
