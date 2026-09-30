import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildEnquiryMessage } from "../src/lib/enquiryMessage.js";

describe("WhatsApp Enquiry Message Generator Tests", () => {
  const mockStore = {
    _id: "store_0103",
    storeName: "Vastra Heritage Boutique",
    city: "Jaipur",
    address: { area: "Johari Bazaar" },
  };

  const mockCart = [
    {
      product: {
        _id: "p1",
        productName: "Hand Block Print Cotton Kurta",
        price: { min: 1299, unit: "piece" },
        brand: "Vastra Heritage",
      },
      quantity: 2,
    },
    {
      product: {
        _id: "p2",
        productName: "Rajasthani Bandhani Dupatta",
        price: { min: 850, unit: "piece" },
        brand: "Vastra Heritage",
      },
      quantity: 1,
    },
  ];

  it("returns empty string when cart is empty or null", () => {
    assert.equal(buildEnquiryMessage(mockStore, []), "");
    assert.equal(buildEnquiryMessage(mockStore, null), "");
    assert.equal(buildEnquiryMessage(null, mockCart), "");
  });

  it("includes store name and location in the header", () => {
    const msg = buildEnquiryMessage(mockStore, mockCart);
    assert.ok(msg.includes("Vastra Heritage Boutique"), "Should contain store name");
    assert.ok(msg.includes("Johari Bazaar, Jaipur"), "Should contain location");
    assert.ok(msg.includes("BHARATSHOPPY"), "Should reference BharatShoppy");
  });

  it("lists all items with quantities and prices accurately", () => {
    const msg = buildEnquiryMessage(mockStore, mockCart);
    assert.ok(msg.includes("Hand Block Print Cotton Kurta"));
    assert.ok(msg.includes("Qty: *2 piece*"));
    assert.ok(msg.includes("₹1,299/piece"));
    assert.ok(msg.includes("Rajasthani Bandhani Dupatta"));
    assert.ok(msg.includes("Qty: *1 piece*"));
  });

  it("calculates total units count and estimated total accurately", () => {
    const msg = buildEnquiryMessage(mockStore, mockCart);
    // Total units = 2 + 1 = 3
    assert.ok(msg.includes("Total Items Count:* 3 unit(s)"), "Should calculate 3 units");
    // Total est = (1299 * 2) + 850 = 2598 + 850 = 3448
    assert.ok(msg.includes("₹3,448"), "Should calculate total value of ₹3,448");
  });

  it("includes customer request note when provided", () => {
    const note = "Please confirm size L availability and delivery to Civil Lines.";
    const msg = buildEnquiryMessage(mockStore, mockCart, note);
    assert.ok(msg.includes(`Customer Request / Note:* "${note}"`));
  });

  it("omits customer note section when note is empty or whitespace", () => {
    const msg = buildEnquiryMessage(mockStore, mockCart, "   ");
    assert.ok(!msg.includes("Customer Request / Note:*"));
  });
});
