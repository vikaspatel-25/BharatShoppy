/**
 * Normalizes phone numbers to E.164 standard.
 * Defaults 10-digit Indian numbers to +91 country code.
 */
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") {
    throw new Error("Phone number is required and must be a string");
  }

  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, "");

  if (cleaned.startsWith("+")) {
    if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      return cleaned;
    }
    throw new Error(
      "Invalid international phone number format. Must conform to E.164 (e.g. +919876543210)."
    );
  }

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
    if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      return cleaned;
    }
  }

  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  throw new Error(
    "Invalid phone number format. Must be a valid mobile number conforming to E.164."
  );
}
