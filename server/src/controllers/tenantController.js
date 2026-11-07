import mongoose from "mongoose";
import { extractSubdomain } from "../lib/domainHelper.js";

/**
 * Resolves a tenant by subdomain, slug, or explicit identifier.
 * Used by the client to boot into an isolated tenant storefront.
 */
export async function resolveTenant(req, res) {
  try {
    const rawHost =
      req.headers["x-forwarded-host"] ||
      req.headers["host"] ||
      req.hostname ||
      "";

    const extracted = extractSubdomain(rawHost);

    const identifier = (
      req.query.subdomain ||
      req.query.identifier ||
      extracted ||
      ""
    )
      .trim()
      .toLowerCase();

    if (!identifier) {
      return res.status(400).json({
        message: "Tenant identifier (subdomain or slug) is required",
      });
    }

    const storesCollection = mongoose.connection?.db?.collection("stores");
    if (!storesCollection) {
      return res.status(503).json({
        message: "Database connection not ready",
      });
    }

    const escapedId = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idRegex = new RegExp(`^${escapedId}$`, "i");

    // Match by subdomain, slug, or _id using targeted case-insensitive index query
    const store = await storesCollection.findOne({
      $or: [
        { _id: identifier },
        { subdomain: idRegex },
        { slug: idRegex },
      ],
      isActive: { $ne: false },
    });

    if (!store) {
      return res.status(404).json({
        message: `Tenant "${identifier}" not found or is currently inactive`,
      });
    }

    const entityType =
      store.entityType ||
      (store.storeCategory?.toLowerCase().includes("organic")
        ? "farmer"
        : store.storeCategory?.toLowerCase().includes("service")
        ? "service_provider"
        : "shopkeeper");

    return res.json({
      store: {
        ...store,
        entityType,
        subdomain: store.subdomain || store.slug,
      },
      entityType,
      subdomain: store.subdomain || store.slug,
    });
  } catch (error) {
    console.error("resolveTenant error:", error);
    return res.status(500).json({
      message: "Internal server error resolving tenant.",
    });
  }
}
