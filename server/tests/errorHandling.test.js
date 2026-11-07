import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-key-that-is-at-least-32-chars-long";
const { errorHandler } = await import("../src/app.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe("Global Error Handling and Error Leak Prevention Tests (M5)", () => {
  it("errorHandler logs internally and returns generic 500 message without leaking error text", () => {
    const sensitiveError = new Error(
      "FATAL: Password authentication failed for user 'admin' on 10.0.0.12:5432"
    );
    sensitiveError.stack = "Error: FATAL at /secret/path/to/db.js:123:45";

    const req = {};
    const res = createMockRes();
    let calledNext = false;

    errorHandler(sensitiveError, req, res, () => {
      calledNext = true;
    });

    assert.equal(res.statusCode, 500);
    assert.equal(calledNext, false);
    assert.deepEqual(res.body, {
      message: "An internal server error occurred. Please try again later.",
    });

    // Ensure sensitive details are not present in response body
    const bodyString = JSON.stringify(res.body);
    assert.equal(bodyString.includes("authentication failed"), false);
    assert.equal(bodyString.includes("10.0.0.12"), false);
    assert.equal(bodyString.includes("secret/path"), false);
    assert.equal(res.body.error, undefined);
  });

  it("verifies no controller files return error: error.message in server/src", () => {
    const srcDir = path.resolve(__dirname, "../src");
    
    function findFiles(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(findFiles(fullPath));
        } else if (file.endsWith(".js")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const jsFiles = findFiles(srcDir);
    const violatingFiles = [];

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("error: error.message") || content.includes("error: err.message")) {
        violatingFiles.push(path.relative(srcDir, file));
      }
    }

    assert.deepEqual(
      violatingFiles,
      [],
      `Found forbidden 'error: error.message' in files: ${violatingFiles.join(", ")}`
    );
  });
});
