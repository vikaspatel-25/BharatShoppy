import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  setTestCloudinaryClient,
  resetTestCloudinaryClient,
  signUploadParams,
  validateProductMedia,
  deleteCloudinaryMedia,
} from "../src/services/cloudinaryService.js";
import {
  addVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
} from "../src/controllers/vendorCatalogController.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

describe("Cloudinary Media Service & Image Lifecycle Tests (H2)", () => {
  let server;
  let baseUrl;
  let app;
  let signToken;
  let setInMemoryVendor;
  let resetInMemoryVendors;
  let vendorTokenStoreA;
  let vendorTokenStoreB;

  const destroyedAssets = [];
  const mockCloudinary = {
    destroy: async (publicId) => {
      destroyedAssets.push(publicId);
      return { result: "ok" };
    },
    signUploadParams: ({ storeId }) => ({
      signature: "mock_signature_123",
      timestamp: 1700000000,
      folder: `bharatshopy/${storeId}`,
      apiKey: "mock_api_key",
      cloudName: "mock_cloud",
      allowedFormats: ["jpg", "jpeg", "png", "webp"],
      maxFileSize: 5 * 1024 * 1024,
    }),
  };

  let mockDbStores = [];
  let mockDbProducts = [];

  const mockDb = {
    collection(name) {
      if (name === "stores") {
        return {
          findOne: async (query) => {
            if (query.$or) {
              return (
                mockDbStores.find(
                  (s) =>
                    s._id === query.$or[0]._id ||
                    (s.slug && query.$or[1]?.slug && s.slug === query.$or[1].slug) ||
                    (s.subdomain && query.$or[2]?.subdomain && s.subdomain === query.$or[2].subdomain)
                ) || null
              );
            }
            if (query._id) {
              return mockDbStores.find((s) => s._id === query._id) || null;
            }
            return null;
          },
          updateOne: async (query, update) => {
            const store = mockDbStores.find((s) => s._id === query._id);
            if (store && update.$set) {
              Object.assign(store, update.$set);
            }
            return { matchedCount: store ? 1 : 0 };
          },
        };
      }
      if (name === "vendors") {
        return {
          findOne: async (query) => {
            if (query._id) {
              return mockDbVendors.find((v) => v._id === query._id) || null;
            }
            if (query.email) {
              return mockDbVendors.find((v) => v.email === query.email) || null;
            }
            return null;
          },
        };
      }
      if (name === "products") {
        return {
          countDocuments: async (query) => {
            return mockDbProducts.filter((p) => p.storeId === query.storeId).length;
          },
          findOne: async (query) => {
            return (
              mockDbProducts.find(
                (p) =>
                  p._id === query._id &&
                  (!query.storeId || p.storeId === query.storeId)
              ) || null
            );
          },
          insertOne: async (doc) => {
            mockDbProducts.push(doc);
            return { insertedId: doc._id };
          },
          updateOne: async (query, update) => {
            const prod = mockDbProducts.find(
              (p) =>
                p._id === query._id &&
                (!query.storeId || p.storeId === query.storeId)
            );
            if (prod && update.$set) {
              Object.assign(prod, update.$set);
              return { matchedCount: 1, modifiedCount: 1 };
            }
            return { matchedCount: 0, modifiedCount: 0 };
          },
        };
      }
      if (name === "auth_limits") {
        return {
          findOne: async () => null,
          updateOne: async () => ({ upsertedCount: 1 }),
          deleteOne: async () => ({ deletedCount: 0 }),
        };
      }
      throw new Error(`Unhandled mock collection: ${name}`);
    },
  };

  let mockDbVendors = [];

  before(async () => {
    process.env.AUTH_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    process.env.NODE_ENV = "test";
    process.env.CLOUDINARY_CLOUD_NAME = "bharatshopy-test";
    process.env.CLOUDINARY_API_KEY = "123456789012345";
    process.env.CLOUDINARY_API_SECRET = "mock_secret_abcdef12345";

    mongoose.connection.db = mockDb;

    const tokenHelper = await import("../src/lib/tokenHelper.js");
    signToken = tokenHelper.signToken;

    const vendorController = await import("../src/controllers/vendorAuthController.js");
    setInMemoryVendor = vendorController.setInMemoryVendor;
    resetInMemoryVendors = vendorController.resetInMemoryVendors;

    const appModule = await import("../src/app.js");
    app = appModule.default;

    vendorTokenStoreA = signToken({
      role: "vendor",
      vendorId: "vend_A",
      email: "vend_a@test.com",
      status: "approved",
      storeId: "store_A",
    });

    vendorTokenStoreB = signToken({
      role: "vendor",
      vendorId: "vend_B",
      email: "vend_b@test.com",
      status: "approved",
      storeId: "store_B",
    });

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    resetTestCloudinaryClient();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    destroyedAssets.length = 0;
    resetTestCloudinaryClient();
    resetInMemoryVendors();

    mockDbStores = [
      {
        _id: "store_A",
        storeName: "Store Alpha",
        slug: "store-alpha",
        limits: { maxImagesPerProduct: 3, productMonthlyLimit: 20 },
      },
      {
        _id: "store_B",
        storeName: "Store Beta",
        slug: "store-beta",
        limits: { maxImagesPerProduct: 5, productMonthlyLimit: 20 },
      },
    ];

    mockDbVendors = [
      { _id: "vend_A", email: "vend_a@test.com", status: "approved", storeId: "store_A" },
      { _id: "vend_B", email: "vend_b@test.com", status: "approved", storeId: "store_B" },
    ];

    setInMemoryVendor(mockDbVendors[0]);
    setInMemoryVendor(mockDbVendors[1]);

    mockDbProducts = [
      {
        _id: "prod_A1",
        storeId: "store_A",
        productName: "Alpha Watch",
        price: { min: 1000, max: 1500, unit: "piece", currency: "INR" },
        images: ["https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/watch_front.jpg"],
        imageAssets: [
          {
            url: "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/watch_front.jpg",
            publicId: "bharatshopy/store_A/watch_front",
          },
          {
            url: "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/watch_side.jpg",
            publicId: "bharatshopy/store_A/watch_side",
          },
        ],
        isActive: true,
      },
    ];
  });

  describe("Media Signing endpoint: POST /api/vendor/store/:storeId/media/sign", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/api/vendor/store/store_A/media/sign`, {
        method: "POST",
      });
      assert.equal(res.status, 401);
    });

    it("rejects vendor attempting to sign for a store they do not own with 403", async () => {
      const res = await fetch(`${baseUrl}/api/vendor/store/store_B/media/sign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vendorTokenStoreA}`,
        },
      });
      assert.equal(res.status, 403);
    });

    it("returns 503 when Cloudinary credentials are not configured", async () => {
      const oldCloud = process.env.CLOUDINARY_CLOUD_NAME;
      const oldKey = process.env.CLOUDINARY_API_KEY;
      const oldSecret = process.env.CLOUDINARY_API_SECRET;
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      try {
        const res = await fetch(`${baseUrl}/api/vendor/store/store_A/media/sign`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vendorTokenStoreA}`,
          },
        });
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.match(data.message, /unconfigured/i);
      } finally {
        process.env.CLOUDINARY_CLOUD_NAME = oldCloud;
        process.env.CLOUDINARY_API_KEY = oldKey;
        process.env.CLOUDINARY_API_SECRET = oldSecret;
      }
    });

    it("returns signed credentials strictly scoped to bharatshopy/<storeId> for authorized owner", async () => {
      setTestCloudinaryClient(mockCloudinary);

      const res = await fetch(`${baseUrl}/api/vendor/store/store_A/media/sign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vendorTokenStoreA}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.folder, "bharatshopy/store_A");
      assert.equal(data.signature, "mock_signature_123");
      assert.equal(data.cloudName, "mock_cloud");
      assert.equal(data.apiKey, "mock_api_key");
    });
  });

  describe("Validation & Security Rules (validateProductMedia)", () => {
    it("rejects base64 data URLs", () => {
      const check1 = validateProductMedia({
        images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."],
        storeId: "store_A",
      });
      assert.equal(check1.valid, false);
      assert.match(check1.message, /Base64/i);

      const check2 = validateProductMedia({
        imageAssets: [
          {
            url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...",
            publicId: "bharatshopy/store_A/test",
          },
        ],
        storeId: "store_A",
      });
      assert.equal(check2.valid, false);
      assert.match(check2.message, /Base64/i);
    });

    it("rejects image assets with publicId outside store's folder", () => {
      const check = validateProductMedia({
        imageAssets: [
          {
            url: "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_B/photo.jpg",
            publicId: "bharatshopy/store_B/photo", // Belongs to Store B, not Store A!
          },
        ],
        storeId: "store_A",
      });
      assert.equal(check.valid, false);
      assert.match(check.message, /does not belong to store folder/i);
    });

    it("rejects image assets originating from foreign Cloudinary account", () => {
      const check = validateProductMedia({
        imageAssets: [
          {
            url: "https://res.cloudinary.com/attacker-cloud/image/upload/v1/bharatshopy/store_A/photo.jpg",
            publicId: "bharatshopy/store_A/photo",
          },
        ],
        storeId: "store_A",
      });
      assert.equal(check.valid, false);
      assert.match(check.message, /does not originate from cloud/i);
    });

    it("allows valid Cloudinary image assets scoped to this store", () => {
      const check = validateProductMedia({
        imageAssets: [
          {
            url: "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/photo.jpg",
            publicId: "bharatshopy/store_A/photo",
          },
        ],
        storeId: "store_A",
      });
      assert.equal(check.valid, true);
    });

    it("allows preexisting URLs on the product during update", () => {
      const existing = {
        images: ["/legacy/path/to/old-photo.jpg"],
        imageAssets: [{ url: "/legacy/path/to/old-photo.jpg" }],
      };
      const check = validateProductMedia({
        images: ["/legacy/path/to/old-photo.jpg"],
        imageAssets: [{ url: "/legacy/path/to/old-photo.jpg" }],
        storeId: "store_A",
        existingProduct: existing,
      });
      assert.equal(check.valid, true);
    });
  });

  describe("Product Catalog Controller Integration (addVendorProduct / updateVendorProduct)", () => {
    it("enforces store plan's maxImagesPerProduct limit on creation", async () => {
      const req = {
        params: { storeId: "store_A" },
        store: mockDbStores[0], // store_A maxImagesPerProduct is 3
        body: {
          productName: "Excessive Images Product",
          price: 500,
          images: ["img1", "img2", "img3", "img4"], // 4 images exceeds limit of 3
        },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /maximum allowed limit of 3/i);
    });

    it("rejects creation with base64 data URLs", async () => {
      const req = {
        params: { storeId: "store_A" },
        store: mockDbStores[0],
        body: {
          productName: "Base64 Product",
          price: 500,
          images: ["data:image/png;base64,dummy..."],
        },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Base64 data URLs are not permitted/i);
    });

    it("successfully creates product with valid Cloudinary assets", async () => {
      const req = {
        params: { storeId: "store_A" },
        store: mockDbStores[0],
        body: {
          productName: "New Valid Product",
          price: 500,
          images: [
            "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/prod1.jpg",
          ],
          imageAssets: [
            {
              url: "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/prod1.jpg",
              publicId: "bharatshopy/store_A/prod1",
            },
          ],
        },
      };
      const res = createMockRes();
      await addVendorProduct(req, res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.product.productName, "New Valid Product");
      assert.equal(res.body.product.imageAssets.length, 1);
    });

    it("deletes removed photo from Cloudinary when updating product", async () => {
      setTestCloudinaryClient(mockCloudinary);

      // Existing prod_A1 has watch_front and watch_side
      // We update it to only have watch_front, removing watch_side
      const req = {
        params: { storeId: "store_A", productId: "prod_A1" },
        store: mockDbStores[0],
        body: {
          imageAssets: [
            {
              url: "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/watch_front.jpg",
              publicId: "bharatshopy/store_A/watch_front",
            },
          ],
          images: [
            "https://res.cloudinary.com/bharatshopy-test/image/upload/v1/bharatshopy/store_A/watch_front.jpg",
          ],
        },
      };
      const res = createMockRes();
      await updateVendorProduct(req, res);

      assert.equal(res.statusCode, 200);

      // Give async background deletion a tick to run
      await new Promise((r) => setTimeout(r, 50));

      assert.equal(destroyedAssets.length, 1);
      assert.equal(destroyedAssets[0], "bharatshopy/store_A/watch_side");
    });

    it("soft-delete product deactivates product and retains photos (does not delete from Cloudinary)", async () => {
      setTestCloudinaryClient(mockCloudinary);

      const req = {
        params: { storeId: "store_A", productId: "prod_A1" },
        store: mockDbStores[0],
      };
      const res = createMockRes();
      await deleteVendorProduct(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.message, "Product deactivated successfully");

      const prod = mockDbProducts.find((p) => p._id === "prod_A1");
      assert.equal(prod.isActive, false);

      // Give async ticks to verify no deletion occurred
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(destroyedAssets.length, 0, "Soft-delete must NOT delete photos from Cloudinary");
    });
  });
});
