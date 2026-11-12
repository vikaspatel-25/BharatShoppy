import mongoose from "mongoose";
import { AUDIT_COLLECTION, getInMemoryAuditLog } from "../services/auditLogService.js";
import { listAdminNotifications, markNotificationsRead } from "../services/notificationService.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/** GET /api/admin/audit-log?page=&limit=&action=&targetType=&search= */
export async function getAuditLog(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 25));
    const filter = {};
    if (typeof req.query?.action === "string" && req.query.action && req.query.action !== "all") {
      filter.action = req.query.action.slice(0, 60);
    }
    if (typeof req.query?.targetType === "string" && req.query.targetType && req.query.targetType !== "all") {
      filter.targetType = req.query.targetType.slice(0, 40);
    }
    const search = typeof req.query?.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    if (search) filter.targetName = { $regex: new RegExp(escapeRegex(search), "i") };

    const col = mongoose.connection?.db?.collection(AUDIT_COLLECTION);
    let entries;
    let total;
    if (col) {
      [entries, total] = await Promise.all([
        col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        col.countDocuments(filter),
      ]);
    } else {
      const rows = getInMemoryAuditLog().filter(
        (e) =>
          (!filter.action || e.action === filter.action) &&
          (!filter.targetType || e.targetType === filter.targetType) &&
          (!search || filter.targetName.$regex.test(e.targetName))
      );
      total = rows.length;
      entries = rows.slice((page - 1) * limit, page * limit);
    }

    return res.json({ entries, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error("getAuditLog error:", error);
    return res.status(500).json({ message: "Failed to load the audit log." });
  }
}

/** GET /api/admin/notifications?limit=&unread=1 */
export async function getNotifications(req, res) {
  try {
    const result = await listAdminNotifications({
      limit: req.query?.limit,
      unreadOnly: req.query?.unread === "1" || req.query?.unread === "true",
    });
    return res.json(result);
  } catch (error) {
    console.error("getNotifications error:", error);
    return res.status(500).json({ message: "Failed to load notifications." });
  }
}

/** POST /api/admin/notifications/mark-read  { id } or { all: true } */
export async function markNotificationRead(req, res) {
  try {
    const { id, all } = req.body || {};
    if (all === true) {
      const changed = await markNotificationsRead("all");
      return res.json({ success: true, changed });
    }
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      return res.status(400).json({ message: "A valid notification ID, or all: true, is required." });
    }
    const changed = await markNotificationsRead(id);
    if (!changed) return res.status(404).json({ message: "Notification not found." });
    return res.json({ success: true, changed });
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return res.status(500).json({ message: "Failed to update notifications." });
  }
}
