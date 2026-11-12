/**
 * One unambiguous date format across the panels, in Indian time: "8 Nov 2026".
 * Returns an empty string for a missing or invalid value.
 */
export function formatDisplayDate(value) {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

/** "8 Nov 2026, 12:40 pm" in Indian time. */
export function formatDisplayDateTime(value) {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
}

/** Today's date as YYYY-MM-DD in Indian time, so it doesn't show yesterday before 5:30 am. */
export function getTodayIstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

/**
 * Turns any error-like value into a plain string that is safe to render.
 * API and upload errors sometimes arrive as objects, and rendering an object crashes React.
 */
export function toMessage(value, fallback = "Something went wrong. Please try again.") {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (typeof value.error === "string" && value.error.trim()) return value.error;
    if (value.error && typeof value.error.message === "string") return value.error.message;
  }
  return fallback;
}
