import test, { describe, it } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { assertSeedAllowed, dummyStores } from "../scripts/seedDummyProfiles.js";
import connectDB, { shouldAutoSeed } from "../src/db/connection.js";
import { checkDbConnection } from "../src/app.js";

describe("Database Seeding Guard Tests", () => {
  it("allows importing seedDummyProfiles.js without side-effects or running seed", () => {
    // Verified by successfully importing dummyStores without triggering file writes or DB connection
    assert.ok(Array.isArray(dummyStores));
    assert.ok(dummyStores.length > 0);
  });

  describe("assertSeedAllowed", () => {
    it("refuses to seed when ALLOW_SEED is missing", () => {
      assert.throws(
        () => assertSeedAllowed({ NODE_ENV: "development" }),
        /ALLOW_SEED=true/
      );
    });

    it("refuses to seed when ALLOW_SEED is false", () => {
      assert.throws(
        () => assertSeedAllowed({ NODE_ENV: "development", ALLOW_SEED: "false" }),
        /ALLOW_SEED=true/
      );
    });

    it("refuses to seed in production even if ALLOW_SEED is true", () => {
      assert.throws(
        () => assertSeedAllowed({ NODE_ENV: "production", ALLOW_SEED: "true" }),
        /strictly prohibited in production/
      );
    });

    it("allows seeding when ALLOW_SEED=true in development or non-production", () => {
      assert.doesNotThrow(() =>
        assertSeedAllowed({ NODE_ENV: "development", ALLOW_SEED: "true" })
      );
      assert.doesNotThrow(() =>
        assertSeedAllowed({ NODE_ENV: "test", ALLOW_SEED: "true" })
      );
    });
  });

  describe("shouldAutoSeed connection guard", () => {
    it("returns false if NODE_ENV is production", () => {
      assert.strictEqual(shouldAutoSeed({ NODE_ENV: "production", ALLOW_SEED: "true" }), false);
    });

    it("returns false if ALLOW_SEED is missing or false in development", () => {
      assert.strictEqual(shouldAutoSeed({ NODE_ENV: "development" }), false);
      assert.strictEqual(shouldAutoSeed({ NODE_ENV: "development", ALLOW_SEED: "false" }), false);
    });

    it("returns true only when development and ALLOW_SEED=true", () => {
      assert.strictEqual(shouldAutoSeed({ NODE_ENV: "development", ALLOW_SEED: "true" }), true);
    });
  });

  describe("M4: Startup and Database Disconnect Handling", () => {
    it("throws at startup in production when MONGO_URI is missing", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalUri = process.env.MONGO_URI;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.MONGO_URI;

        await assert.rejects(
          async () => {
            await connectDB();
          },
          /Missing required MONGO_URI in production environment/
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.MONGO_URI = originalUri;
      }
    });

    it("returns 503 from database routes when database is disconnected", () => {
      const originalDb = mongoose.connection.db;
      const originalReadyState = mongoose.connection.readyState;

      try {
        delete mongoose.connection.db;
        // 0 = disconnected
        Object.defineProperty(mongoose.connection, "readyState", {
          value: 0,
          configurable: true,
        });

        let statusCode = 200;
        let responseBody = null;
        let calledNext = false;

        const req = {};
        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            responseBody = data;
            return this;
          },
        };

        checkDbConnection(req, res, () => {
          calledNext = true;
        });

        assert.strictEqual(calledNext, false, "Must not call next() when disconnected");
        assert.strictEqual(statusCode, 503, "Must return 503 Service Unavailable");
        assert.match(responseBody.message, /Database service unavailable/i);
      } finally {
        mongoose.connection.db = originalDb;
        Object.defineProperty(mongoose.connection, "readyState", {
          value: originalReadyState,
          configurable: true,
        });
      }
    });

    it("calls next() when database connection is active", () => {
      let calledNext = false;
      const req = {};
      const res = {};

      checkDbConnection(req, res, () => {
        calledNext = true;
      });

      assert.strictEqual(calledNext, true, "Must call next() when database connection is open");
    });
  });
});
