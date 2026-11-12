import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDisplayDate, formatDisplayDateTime, getTodayIstDateString, toMessage } from "../src/lib/formatDate.js";

describe("P1: date display helpers", () => {
  it("formats a date as day, short month and year", () => {
    assert.equal(formatDisplayDate("2026-11-08T06:00:00.000Z"), "8 Nov 2026");
  });

  it("uses the Indian date for a time late in the UTC day", () => {
    // 20:00 UTC on 7 Nov is 01:30 on 8 Nov in India
    assert.equal(formatDisplayDate("2026-11-07T20:00:00.000Z"), "8 Nov 2026");
    assert.equal(getTodayIstDateString(new Date("2026-11-07T20:00:00.000Z")), "2026-11-08");
  });

  it("returns an empty string for missing or invalid values", () => {
    assert.equal(formatDisplayDate(null), "");
    assert.equal(formatDisplayDate(undefined), "");
    assert.equal(formatDisplayDate(""), "");
    assert.equal(formatDisplayDate("not a date"), "");
    assert.equal(formatDisplayDateTime("nope"), "");
  });

  it("includes the time in the date and time format", () => {
    const text = formatDisplayDateTime("2026-11-08T07:10:00.000Z");
    assert.match(text, /^8 Nov 2026, 12:40\s?pm$/i);
  });
});

describe("P1: toMessage always returns a string", () => {
  it("passes a string through", () => {
    assert.equal(toMessage("Saved"), "Saved");
  });

  it("reads message or error from an object", () => {
    assert.equal(toMessage({ message: "Too large" }), "Too large");
    assert.equal(toMessage({ error: "Bad file" }), "Bad file");
    assert.equal(toMessage({ error: { message: "Invalid image file" } }), "Invalid image file");
    assert.equal(toMessage(new Error("Network down")), "Network down");
  });

  it("falls back for values with no text", () => {
    assert.equal(toMessage({}, "Fallback"), "Fallback");
    assert.equal(toMessage(null, "Fallback"), "Fallback");
    assert.equal(toMessage(42, "Fallback"), "Fallback");
    assert.equal(typeof toMessage(undefined), "string");
  });
});
