import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Store Timing & Open Status Tests", () => {
  function formatTime(time24) {
    if (!time24) return "";
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m < 10 ? "0" : ""}${m} ${period}`;
  }

  function checkOpenStatus(todayHours, currentMinutes) {
    if (!todayHours || !todayHours.open || !todayHours.close) {
      return { isOpen: false, text: "Closed today" };
    }

    const [openH, openM] = todayHours.open.split(":").map(Number);
    const [closeH, closeM] = todayHours.close.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return {
        isOpen: true,
        text: `Open now · Closes at ${formatTime(todayHours.close)}`,
      };
    } else if (currentMinutes < openMinutes) {
      return {
        isOpen: false,
        text: `Closed now · Opens at ${formatTime(todayHours.open)}`,
      };
    } else {
      return {
        isOpen: false,
        text: `Closed now · Opens tomorrow`,
      };
    }
  }

  describe("formatTime", () => {
    it("formats morning hours correctly", () => {
      assert.equal(formatTime("09:30"), "9:30 AM");
      assert.equal(formatTime("11:00"), "11:00 AM");
    });

    it("formats afternoon and evening hours correctly", () => {
      assert.equal(formatTime("13:15"), "1:15 PM");
      assert.equal(formatTime("21:00"), "9:00 PM");
      assert.equal(formatTime("23:45"), "11:45 PM");
    });

    it("handles 12 PM (noon) and 12 AM (midnight) accurately", () => {
      assert.equal(formatTime("12:00"), "12:00 PM");
      assert.equal(formatTime("00:00"), "12:00 AM");
    });
  });

  describe("checkOpenStatus", () => {
    const todayHours = { open: "10:00", close: "20:00" }; // 10:00 AM to 8:00 PM

    it("detects store is open during business hours", () => {
      const midDayMinutes = 14 * 60; // 2:00 PM
      const status = checkOpenStatus(todayHours, midDayMinutes);

      assert.equal(status.isOpen, true);
      assert.ok(status.text.includes("Open now"));
      assert.ok(status.text.includes("8:00 PM"));
    });

    it("detects store is closed before opening time", () => {
      const morningMinutes = 8 * 60; // 8:00 AM
      const status = checkOpenStatus(todayHours, morningMinutes);

      assert.equal(status.isOpen, false);
      assert.ok(status.text.includes("Closed now"));
      assert.ok(status.text.includes("10:00 AM"));
    });

    it("detects store is closed after closing time", () => {
      const nightMinutes = 22 * 60; // 10:00 PM
      const status = checkOpenStatus(todayHours, nightMinutes);

      assert.equal(status.isOpen, false);
      assert.ok(status.text.includes("Closed now"));
      assert.ok(status.text.includes("tomorrow"));
    });

    it("gracefully returns 'Closed today' when hours are missing", () => {
      const status = checkOpenStatus(null, 12 * 60);
      assert.equal(status.isOpen, false);
      assert.equal(status.text, "Closed today");
    });
  });
});
