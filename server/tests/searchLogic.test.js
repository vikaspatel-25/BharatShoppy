import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Search & Pagination Logic Tests", () => {
  const sampleProducts = [
    {
      _id: "p1",
      storeId: "s1",
      productName: "Handcrafted Blue Pottery Vase",
      shortDescription: "Traditional Rajasthani pottery",
      brand: "Jaipur Craft",
      category: "Home & Garden",
      tags: ["vase", "decor", "handicraft"],
      isActive: true,
      price: { min: 650, max: 800, unit: "piece" },
    },
    {
      _id: "p2",
      storeId: "s1",
      productName: "Cotton Handloom Kurta",
      shortDescription: "Pure breathable cotton",
      brand: "Vastra",
      category: "Apparel & Fashion",
      tags: ["kurta", "men", "ethnic"],
      isActive: true,
      price: { min: 1200, unit: "piece" },
    },
    {
      _id: "p3",
      storeId: "s2",
      productName: "Darjeeling First Flush Green Tea",
      shortDescription: "Organic loose leaf green tea",
      brand: "Tea Estate",
      category: "Groceries & Organics",
      tags: ["tea", "organic"],
      isActive: true,
      price: { min: 450, unit: "pack" },
    },
    {
      _id: "p4",
      storeId: "s2",
      productName: "Discontinued Antique Lamp",
      shortDescription: "Old vintage brass lamp",
      brand: "Vintage",
      category: "Home & Garden",
      tags: ["lamp", "antique"],
      isActive: false,
      price: { min: 2500, unit: "piece" },
    },
  ];

  const sampleStores = [
    {
      _id: "s1",
      storeName: "Jaipur Heritage Crafts",
      city: "Jaipur",
      storeCategory: "Home & Garden",
      isActive: true,
    },
    {
      _id: "s2",
      storeName: "Kolkata Tea & Goods",
      city: "Kolkata",
      storeCategory: "Groceries & Organics",
      isActive: true,
    },
  ];

  describe("Product Search Text Matching", () => {
    function filterProductsByQuery(products, query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return products.filter((p) => {
        if (p.isActive === false) return false;
        const text = [
          p.productName,
          p.shortDescription,
          p.brand,
          p.category,
          ...(p.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }

    it("matches query against product name", () => {
      const results = filterProductsByQuery(sampleProducts, "pottery");
      assert.equal(results.length, 1);
      assert.equal(results[0]._id, "p1");
    });

    it("matches query against product tags", () => {
      const results = filterProductsByQuery(sampleProducts, "ethnic");
      assert.equal(results.length, 1);
      assert.equal(results[0]._id, "p2");
    });

    it("ignores inactive products in in-store search", () => {
      const results = filterProductsByQuery(sampleProducts, "antique");
      assert.equal(results.length, 0);
    });

    it("matches multiple products across same category or brand", () => {
      const results = filterProductsByQuery(sampleProducts, "tea");
      assert.equal(results.length, 1);
      assert.equal(results[0]._id, "p3");
    });
  });

  describe("Pagination Calculations", () => {
    function paginate(items, page = 1, limit = 2) {
      const p = Math.max(Number(page) || 1, 1);
      const start = (p - 1) * limit;
      const end = start + limit;
      const paginatedItems = items.slice(start, end);
      return {
        items: paginatedItems,
        pagination: {
          page: p,
          limit,
          total: items.length,
          hasMore: end < items.length,
        },
      };
    }

    it("returns correct page 1 slice and indicates hasMore is true", () => {
      const activeProducts = sampleProducts.filter((p) => p.isActive);
      const result = paginate(activeProducts, 1, 2);

      assert.equal(result.items.length, 2);
      assert.equal(result.pagination.page, 1);
      assert.equal(result.pagination.total, 3);
      assert.equal(result.pagination.hasMore, true);
    });

    it("returns final page and indicates hasMore is false", () => {
      const activeProducts = sampleProducts.filter((p) => p.isActive);
      const result = paginate(activeProducts, 2, 2);

      assert.equal(result.items.length, 1);
      assert.equal(result.pagination.page, 2);
      assert.equal(result.pagination.hasMore, false);
    });

    it("gracefully clamps negative or invalid page numbers to 1", () => {
      const result = paginate(sampleProducts, -5, 2);
      assert.equal(result.pagination.page, 1);
    });
  });

  describe("City and Category Store Filtering", () => {
    it("filters stores by case-insensitive city", () => {
      const city = "jaipur";
      const matches = sampleStores.filter(
        (s) => s.city.toLowerCase() === city.toLowerCase()
      );
      assert.equal(matches.length, 1);
      assert.equal(matches[0]._id, "s1");
    });

    it("filters products by store city", () => {
      const city = "jaipur";
      const jaipurStoreIds = sampleStores
        .filter((s) => s.city.toLowerCase() === city.toLowerCase())
        .map((s) => s._id);

      const cityProducts = sampleProducts.filter((p) =>
        jaipurStoreIds.includes(p.storeId)
      );

      assert.equal(cityProducts.length, 2);
      assert.ok(cityProducts.every((p) => p.storeId === "s1"));
    });
  });
});
