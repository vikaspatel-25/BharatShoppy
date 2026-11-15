/**
 * Plain helpers for the admin pages. No React and no imports, so tests can load it directly.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_DAYS = 1;
export const MAX_DAYS = 366;

/** True for a whole number of days from 1 to 366, the range the server accepts. */
export function isValidDuration(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= MIN_DAYS && n <= MAX_DAYS && String(value).trim() !== "";
}

/**
 * The end date a renewal or activation gives: days added to the later of now and the
 * current end date, as the server does (H6). Returns null for a bad duration.
 */
export function computeNewExpiry(currentExpiresAt, days, now = new Date()) {
  if (!isValidDuration(days)) return null;
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = current && !Number.isNaN(current.getTime()) && current > now ? current : now;
  return new Date(base.getTime() + Number(days) * DAY_MS);
}

/**
 * Plain wording for a 409 from the admin routes. The server's own text is kept when it
 * doesn't match a known case.
 */
export function conflictMessage(serverMessage) {
  const m = String(serverMessage || "").toLowerCase();
  if (m.includes("pending removal")) {
    return "This store is being removed, so its plan can't be changed. Cancel the removal first.";
  }
  if (m.includes("concurrent")) {
    return "Someone else changed this at the same time. The latest details are shown now; check them and try again.";
  }
  // Slug and email clashes carry their own useful detail
  if (m.includes("slug") || m.includes("subdomain") || m.includes("email")) return String(serverMessage);
  if (m.includes("already") || m.includes("no longer pending") || m.includes("status '")) {
    return "This was already decided, perhaps by someone else. The list now shows the latest state.";
  }
  return String(serverMessage || "This couldn't be done because the record changed. Refresh and try again.");
}

/** Readable label and badge tone for each audit action. */
export const AUDIT_ACTIONS = {
  "application.approve": { label: "Approved application", tone: "success" },
  "application.reject": { label: "Rejected application", tone: "danger" },
  "plan_request.approve": { label: "Activated plan request", tone: "success" },
  "plan_request.reject": { label: "Declined plan request", tone: "danger" },
  "store.renew": { label: "Set or renewed plan", tone: "success" },
  "store.discontinue": { label: "Ended plan", tone: "danger" },
  "store.renewal_reminder": { label: "Sent renewal reminder", tone: "info" },
  "vendor.remove": { label: "Removed vendor", tone: "danger" },
  "vendor.cancel_removal": { label: "Cancelled removal", tone: "info" },
  "listing.hide": { label: "Hid listing", tone: "warn" },
  "listing.restore": { label: "Restored listing", tone: "success" },
  "plan.update": { label: "Edited plan", tone: "brand" },
};

export function auditActionLabel(action) {
  return AUDIT_ACTIONS[action] || { label: String(action || "Unknown action").replace(/[._]/g, " "), tone: "neutral" };
}

const TARGET_LABELS = { application: "Application", plan_request: "Plan request", store: "Store", vendor: "Vendor", listing: "Listing", product: "Listing", plan: "Plan" };

export function targetTypeLabel(type) {
  return TARGET_LABELS[type] || String(type || "");
}

/** "durationDays" -> "Duration days", for the audit detail rows. */
export function humaniseKey(key) {
  const spaced = String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A details value as plain text: never raw JSON for objects. */
export function detailValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(detailValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => `${humaniseKey(k)}: ${detailValue(v)}`)
      .join("; ");
  }
  return String(value);
}

/** Applications that match a search on name, store name, email, phone, slug or city. */
export function matchesApplication(app, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return [app.name, app.storeName, app.email, app.phone, app.slug, app.subdomain, app.address?.city]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

/** Counts per status for tab badges. */
export function countByStatus(rows, statuses) {
  const counts = { all: rows.length };
  statuses.forEach((s) => {
    counts[s] = 0;
  });
  rows.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  });
  return counts;
}
