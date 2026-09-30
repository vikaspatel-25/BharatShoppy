import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Shop-Specific Cart Logic & Calculation Tests", () => {
  function calculateTotalUnits(cart) {
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  function calculateEstimatedTotal(cart) {
    return cart.reduce((sum, item) => {
      const min = item.product?.price?.min || 0;
      return sum + min * (item.quantity || 1);
    }, 0);
  }

  function addToCartLogic(currentCart, product, quantity = 1) {
    const existingIndex = currentCart.findIndex(
      (item) => item.product._id === product._id
    );
    if (existingIndex > -1) {
      const updated = [...currentCart];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + quantity,
      };
      return updated;
    }
    return [...currentCart, { product, quantity }];
  }

  function updateQuantityLogic(currentCart, productId, quantity) {
    if (quantity <= 0) {
      return currentCart.filter((item) => item.product._id !== productId);
    }
    return currentCart.map((item) =>
      item.product._id === productId ? { ...item, quantity } : item
    );
  }

  it("calculates total units correctly across multiple products", () => {
    const cart = [
      { product: { _id: "1", price: { min: 100 } }, quantity: 3 },
      { product: { _id: "2", price: { min: 250 } }, quantity: 2 },
    ];
    assert.equal(calculateTotalUnits(cart), 5);
  });

  it("calculates total estimated amount correctly", () => {
    const cart = [
      { product: { _id: "1", price: { min: 150 } }, quantity: 2 }, // 300
      { product: { _id: "2", price: { min: 400 } }, quantity: 1 }, // 400
    ];
    assert.equal(calculateEstimatedTotal(cart), 700);
  });

  it("adds new product to cart", () => {
    const cart = [];
    const product = { _id: "p1", productName: "Item 1", price: { min: 100 } };
    const updated = addToCartLogic(cart, product, 1);

    assert.equal(updated.length, 1);
    assert.equal(updated[0].quantity, 1);
    assert.equal(updated[0].product._id, "p1");
  });

  it("increments quantity when existing product is added again", () => {
    const product = { _id: "p1", productName: "Item 1", price: { min: 100 } };
    const initialCart = [{ product, quantity: 2 }];
    const updated = addToCartLogic(initialCart, product, 3);

    assert.equal(updated.length, 1);
    assert.equal(updated[0].quantity, 5);
  });

  it("removes product when quantity is updated to 0 or negative", () => {
    const product = { _id: "p1", productName: "Item 1", price: { min: 100 } };
    const initialCart = [{ product, quantity: 2 }];

    const updatedZero = updateQuantityLogic(initialCart, "p1", 0);
    assert.equal(updatedZero.length, 0);

    const updatedNegative = updateQuantityLogic(initialCart, "p1", -1);
    assert.equal(updatedNegative.length, 0);
  });
});
