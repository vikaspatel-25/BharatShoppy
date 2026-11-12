import mongoose from "mongoose";

/**
 * In-app notifications for the admin (the bell in the panel header). They back up the
 * emails, which are allowed to fail without losing the underlying record.
 * Creating one never fails the request that caused it.
 */

const COLLECTION = "admin_notifications";
export const NOTIFICATION_TYPES = new Set(["new_application", "plan_request", "store_renamed", "system"]);

let inMemoryNotifications = [];

export function getInMemoryNotifications() {
  return inMemoryNotifications;
}
export function resetInMemoryNotifications() {
  inMemoryNotifications = [];
}

function collection() {
  return mongoose.connection?.db?.collection(COLLECTION) || null;
}

const clip = (v, n) => String(v ?? "").slice(0, n);

export async function createAdminNotification({ type, title, message, link = "", metadata = {}, now = new Date() }) {
  try {
    if (!NOTIFICATION_TYPES.has(type)) throw new Error(`Unknown notification type '${type}'`);
    const doc = {
      _id: `ntf_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title: clip(title, 140),
      message: clip(message, 500),
      link: clip(link, 200),
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      read: false,
      createdAt: now.toISOString(),
    };
    const col = collection();
    if (col) await col.insertOne(doc);
    else inMemoryNotifications.unshift(doc);
    return doc;
  } catch (err) {
    console.error("Admin notification failed:", err?.message || err);
    return null;
  }
}

export async function listAdminNotifications({ limit = 20, unreadOnly = false } = {}) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const query = unreadOnly ? { read: false } : {};
  const col = collection();
  if (col) {
    const [notifications, unreadCount] = await Promise.all([
      col.find(query).sort({ createdAt: -1 }).limit(safeLimit).toArray(),
      col.countDocuments({ read: false }),
    ]);
    return { notifications, unreadCount };
  }
  const rows = inMemoryNotifications.filter((n) => !unreadOnly || !n.read);
  return { notifications: rows.slice(0, safeLimit), unreadCount: inMemoryNotifications.filter((n) => !n.read).length };
}

/** Marks one notification, or all of them with id "all". Returns the number changed. */
export async function markNotificationsRead(id) {
  const col = collection();
  if (id === "all") {
    if (col) return (await col.updateMany({ read: false }, { $set: { read: true } })).modifiedCount || 0;
    let n = 0;
    for (const item of inMemoryNotifications) if (!item.read) { item.read = true; n += 1; }
    return n;
  }
  if (col) return (await col.updateOne({ _id: id }, { $set: { read: true } })).matchedCount || 0;
  const item = inMemoryNotifications.find((x) => x._id === id);
  if (!item) return 0;
  item.read = true;
  return 1;
}

export const NOTIFICATION_COLLECTION = COLLECTION;
