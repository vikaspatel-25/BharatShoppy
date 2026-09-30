import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRelevanceScore, searchLocations } from "../src/controllers/locationController.js";

describe("Location Controller Tests", () => {
  describe("getRelevanceScore", () => {
    it("assigns highest priority to exact city match", () => {
      const location = { city: "Jaipur", state: "Rajasthan", displayName: "Jaipur, Rajasthan" };
      const score = getRelevanceScore(location, "jaipur");
      // Exact city match gives 100 + startsWith (80) + includes (60) + displayName includes (10) = 250
      assert.ok(score >= 100, `Expected score >= 100, got ${score}`);
    });

    it("gives higher score to city prefix match than state match only", () => {
      const cityPrefixLoc = { city: "Kolkata", state: "West Bengal", displayName: "Kolkata, West Bengal" };
      const stateOnlyLoc = { city: "Siliguri", state: "West Bengal", displayName: "Siliguri, West Bengal" };

      const prefixScore = getRelevanceScore(cityPrefixLoc, "kol");
      const stateScore = getRelevanceScore(stateOnlyLoc, "bengal");

      assert.ok(prefixScore > stateScore, `Prefix score (${prefixScore}) should exceed state score (${stateScore})`);
    });

    it("handles missing or null fields gracefully without throwing", () => {
      const emptyLoc = {};
      const score = getRelevanceScore(emptyLoc, "mumbai");
      assert.equal(score, 0);
    });
  });

  describe("searchLocations empty query guard", () => {
    it("returns empty array immediately if query is missing", async () => {
      let responseData = null;
      const mockReq = { query: {} };
      const mockRes = {
        json: (data) => {
          responseData = data;
          return data;
        },
      };

      await searchLocations(mockReq, mockRes);
      assert.deepEqual(responseData, []);
    });

    it("returns empty array immediately if query is whitespace only", async () => {
      let responseData = null;
      const mockReq = { query: { q: "   " } };
      const mockRes = {
        json: (data) => {
          responseData = data;
          return data;
        },
      };

      await searchLocations(mockReq, mockRes);
      assert.deepEqual(responseData, []);
    });
  });
});
