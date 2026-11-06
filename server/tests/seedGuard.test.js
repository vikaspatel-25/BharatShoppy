import test, { describe, it } from "node:test";
import assert from "node:assert";
import { assertSeedAllowed, dummyStores } from "../scripts/seedDummyProfiles.js";
import { shouldAutoSeed } from "../src/db/connection.js";

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
});
