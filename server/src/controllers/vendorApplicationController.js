import crypto from "node:crypto";
import mongoose from "mongoose";
import { hashString } from "../lib/tokenHelper.js";
import { checkRateLimit } from "../lib/rateLimitHelper.js";
import { isReservedSubdomain } from "../lib/domainHelper.js";
import {
  sendApplicationVerificationCode,
  sendNewApplicationAlert,
  sendApplicationConfirmation,
  sendVendorApprovalEmail,
  sendVendorRejectionEmail,
} from "../services/emailService.js";
import { findVendorByEmail, updateVendor, setInMemoryVendor } from "./vendorAuthController.js";

// In-memory fallbacks for unit testing without MongoDB
let inMemoryApplications = new Map();
let inMemoryApplicationCodes = new Map();

export function setInMemoryApplication(appData) {
  const id = appData._id || "app_" + crypto.randomUUID();
  inMemoryApplications.set(id, {
    ...appData,
    _id: id,
    status: appData.status || "pending",
  });
  return inMemoryApplications.get(id);
}

export function resetInMemoryApplications() {
  inMemoryApplications.clear();
  inMemoryApplicationCodes.clear();
}

export function setInMemoryApplicationCode(email, data) {
  inMemoryApplicationCodes.set(email.toLowerCase().trim(), data);
}

function getApplicationsCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("vendor_applications");
  }
  return null;
}

function getStoresCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("stores");
  }
  return null;
}

function getVendorsCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("vendors");
  }
  return null;
}

function getLimitsCollection() {
  if (mongoose.connection?.db) {
    return mongoose.connection.db.collection("auth_limits");
  }
  return null;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/**
 * Validates slug / subdomain string.
 */
function isValidSlug(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return false;
  return SLUG_REGEX.test(trimmed);
}

/**
 * POST /api/vendor/apply/request-code
 * Sends 6-digit code to email for prospective applicants.
 */
export async function requestApplicationCode(req, res) {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({ message: "Email is required and must be a string." });
    }

    const email = rawEmail.toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "A valid email address is required." });
    }

    const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

    // 1. IP rate limit check
    const ipCheck = await checkRateLimit(`ip_apply:${clientIp}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 15 * 60 * 1000,
    });
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many application code requests from this IP address. Please wait.",
      });
    }

    // 2. Email rate limit check
    const emailCheck = await checkRateLimit(`apply_req:${email}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      cooldownMs: 60 * 1000,
      minIntervalMs: 60 * 1000,
    });
    if (!emailCheck.allowed) {
      return res.status(429).json({
        message: "Please wait before requesting another verification code.",
      });
    }

    // 3. Check existing vendor or pending application
    const existingVendor = await findVendorByEmail(email);
    if (existingVendor) {
      if (existingVendor.status === "approved") {
        return res.status(400).json({
          message: "An approved vendor account already exists with this email. Please sign in.",
        });
      }
      if (existingVendor.status === "pending") {
        return res.status(400).json({
          message: "An application for this email is already pending review.",
        });
      }
    }

    const appCol = getApplicationsCollection();
    if (appCol) {
      const pendingApp = await appCol.findOne({ email, status: "pending" });
      if (pendingApp) {
        return res.status(400).json({
          message: "An application for this email is already pending review.",
        });
      }
    } else {
      for (const app of inMemoryApplications.values()) {
        if (app.email === email && app.status === "pending") {
          return res.status(400).json({
            message: "An application for this email is already pending review.",
          });
        }
      }
    }

    // 4. Generate 6-digit code
    const rawCode = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashString(rawCode);
    const codeExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const limitsCol = getLimitsCollection();
    if (limitsCol) {
      await limitsCol.updateOne(
        { _id: `apply_code:${email}` },
        {
          $set: {
            codeHash,
            codeExpiresAt,
            codeAttempts: 0,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } else {
      inMemoryApplicationCodes.set(email, {
        codeHash,
        codeExpiresAt,
        codeAttempts: 0,
      });
    }

    // 5. Send code
    await sendApplicationVerificationCode(email, rawCode);

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    console.error("requestApplicationCode error:", error);
    return res.status(500).json({ message: "Failed to send application verification code." });
  }
}

/**
 * POST /api/vendor/apply
 * Submits vendor application with verification code.
 */
export async function submitApplication(req, res) {
  try {
    const {
      email: rawEmail,
      code: rawCode,
      name,
      storeName,
      slug: rawSlug,
      subdomain: rawSubdomain,
      phone,
      entityType,
      storeCategory,
      description,
      address,
    } = req.body || {};

    // 1. Validate required fields
    if (
      !rawEmail ||
      typeof rawEmail !== "string" ||
      !rawCode ||
      typeof rawCode !== "string" ||
      !name ||
      typeof name !== "string" ||
      !storeName ||
      typeof storeName !== "string"
    ) {
      return res.status(400).json({
        message: "Email, code, applicant name, and store name are required strings.",
      });
    }

    const email = rawEmail.toLowerCase().trim();
    const code = rawCode.trim();
    const slug = (rawSlug || storeName).toLowerCase().trim().replace(/\s+/g, "-");
    const subdomain = (rawSubdomain || slug).toLowerCase().trim().replace(/\s+/g, "-");

    // 2. Validate slug and subdomain format
    if (!isValidSlug(slug)) {
      return res.status(400).json({
        message: "Store slug must be 3-50 alphanumeric characters with hyphens (e.g. 'sharma-sweets').",
      });
    }

    if (!isValidSlug(subdomain)) {
      return res.status(400).json({
        message: "Subdomain must be 3-50 alphanumeric characters with hyphens.",
      });
    }

    // 3. Reserved subdomains check
    if (isReservedSubdomain(subdomain)) {
      return res.status(400).json({
        message: `Subdomain '${subdomain}' is reserved and cannot be used.`,
      });
    }

    if (isReservedSubdomain(slug)) {
      return res.status(400).json({
        message: `Slug '${slug}' is reserved and cannot be used.`,
      });
    }

    // 4. Verify code
    let codeDoc = null;
    const limitsCol = getLimitsCollection();
    if (limitsCol) {
      codeDoc = await limitsCol.findOne({ _id: `apply_code:${email}` });
    } else {
      codeDoc = inMemoryApplicationCodes.get(email);
    }

    if (!codeDoc || !codeDoc.codeHash) {
      return res.status(400).json({
        message: "No active verification code found for this email. Please request a new code.",
      });
    }

    if (codeDoc.codeExpiresAt && Date.now() > codeDoc.codeExpiresAt) {
      return res.status(400).json({
        message: "Verification code has expired. Please request a new code.",
      });
    }

    if ((codeDoc.codeAttempts || 0) >= 5) {
      return res.status(429).json({
        message: "Too many failed verification attempts. Please request a new code.",
      });
    }

    const hashedInput = hashString(code);
    if (hashedInput !== codeDoc.codeHash) {
      if (limitsCol) {
        await limitsCol.updateOne(
          { _id: `apply_code:${email}` },
          { $inc: { codeAttempts: 1 } }
        );
      } else {
        codeDoc.codeAttempts = (codeDoc.codeAttempts || 0) + 1;
      }
      return res.status(400).json({ message: "Invalid verification code." });
    }

    // Clear code (single-use)
    if (limitsCol) {
      await limitsCol.deleteOne({ _id: `apply_code:${email}` });
    } else {
      inMemoryApplicationCodes.delete(email);
    }

    // 5. Uniqueness checks for slug & subdomain
    const storesCol = getStoresCollection();
    if (storesCol) {
      const existingStore = await storesCol.findOne({
        $or: [{ slug }, { subdomain }],
      });
      if (existingStore) {
        return res.status(409).json({
          message: `The slug or subdomain '${slug}' is already taken by an existing store.`,
        });
      }
    }

    const appCol = getApplicationsCollection();
    if (appCol) {
      // Check duplicate slug/subdomain in pending/approved applications
      const existingApp = await appCol.findOne({
        $or: [{ slug }, { subdomain }],
        status: { $in: ["pending", "approved"] },
      });
      if (existingApp) {
        return res.status(409).json({
          message: `The slug or subdomain '${slug}' is already in use or reserved by another application.`,
        });
      }

      // Check duplicate application for same email
      const pendingAppForEmail = await appCol.findOne({ email, status: "pending" });
      if (pendingAppForEmail) {
        return res.status(409).json({
          message: "An application for this email address is already pending review.",
        });
      }
    } else {
      for (const app of inMemoryApplications.values()) {
        if (
          (app.slug === slug || app.subdomain === subdomain) &&
          (app.status === "pending" || app.status === "approved")
        ) {
          return res.status(409).json({
            message: `The slug or subdomain '${slug}' is already in use or reserved by another application.`,
          });
        }
        if (app.email === email && app.status === "pending") {
          return res.status(409).json({
            message: "An application for this email address is already pending review.",
          });
        }
      }
    }

    // 6. Check existing vendor record
    const existingVendor = await findVendorByEmail(email);
    if (existingVendor) {
      if (existingVendor.status === "approved") {
        return res.status(409).json({
          message: "A registered vendor account already exists with this email address.",
        });
      }
      if (existingVendor.status === "pending") {
        return res.status(409).json({
          message: "An application for this email address is already pending review.",
        });
      }
    }

    // 7. Save application as pending
    const applicationId = "app_" + crypto.randomUUID();
    const now = new Date().toISOString();

    const applicationDoc = {
      _id: applicationId,
      email,
      name: name.trim(),
      storeName: storeName.trim(),
      slug,
      subdomain,
      phone: typeof phone === "string" ? phone.trim() : "",
      entityType: typeof entityType === "string" ? entityType.trim() : "shopkeeper",
      storeCategory: typeof storeCategory === "string" ? storeCategory.trim() : "General",
      description: typeof description === "string" ? description.trim() : "",
      address: typeof address === "object" && address !== null ? address : {},
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    if (appCol) {
      await appCol.insertOne(applicationDoc);
    } else {
      inMemoryApplications.set(applicationId, applicationDoc);
    }

    // 8. Create or update vendor record with status pending and no storeId
    const vendorsCol = getVendorsCollection();
    const vendorId = "vendor_" + crypto.randomUUID();
    const vendorRecord = {
      _id: vendorId,
      email,
      name: name.trim(),
      status: "pending",
      storeId: null,
      createdAt: now,
      updatedAt: now,
    };

    if (vendorsCol) {
      await vendorsCol.updateOne(
        { email },
        { $set: vendorRecord },
        { upsert: true }
      );
    } else {
      setInMemoryVendor(vendorRecord);
    }

    // 9. Send notifications
    await sendApplicationConfirmation(email, { storeName: storeName.trim(), name: name.trim() });
    await sendNewApplicationAlert({
      storeName: storeName.trim(),
      email,
      name: name.trim(),
      city: applicationDoc.address?.city,
      entityType: applicationDoc.entityType,
    });

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully and is pending administrator review.",
      applicationId,
    });
  } catch (error) {
    console.error("submitApplication error:", error);
    return res.status(500).json({ message: "Failed to submit vendor application." });
  }
}

/**
 * GET /api/admin/vendor-applications
 * Admin: lists applications, optionally filtered by status.
 */
export async function listApplications(req, res) {
  try {
    const { status } = req.query;
    const appCol = getApplicationsCollection();

    let applications = [];
    if (appCol) {
      const query = status ? { status } : {};
      applications = await appCol.find(query).sort({ createdAt: -1 }).toArray();
    } else {
      applications = Array.from(inMemoryApplications.values());
      if (status) {
        applications = applications.filter((a) => a.status === status);
      }
      applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("listApplications error:", error);
    return res.status(500).json({ message: "Failed to load vendor applications." });
  }
}

/**
 * POST /api/admin/vendor-applications/:id/approve
 * Admin: Approves pending application, creates store with 'starter_free' plan, and links vendor.
 */
export async function approveApplication(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Application ID is required." });
    }

    const appCol = getApplicationsCollection();
    let app = null;

    if (appCol) {
      app = await appCol.findOne({ _id: id });
    } else {
      app = inMemoryApplications.get(id);
    }

    if (!app) {
      return res.status(404).json({ message: "Vendor application not found." });
    }

    if (app.status !== "pending") {
      return res.status(409).json({
        message: `Cannot approve application with status '${app.status}'. Only pending applications can be approved.`,
      });
    }

    const now = new Date();
    const storeId = `store_${app.slug}`;

    const newStore = {
      _id: storeId,
      storeName: app.storeName,
      slug: app.slug,
      subdomain: app.subdomain,
      entityType: app.entityType || "shopkeeper",
      storeCategory: app.storeCategory || "General",
      description: app.description || "",
      logo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
      images: ["/assets/images/placeholders/storePlaceholder.jpeg"],
      city: app.address?.city || "",
      state: app.address?.state || "",
      location: { latitude: 0, longitude: 0 },
      address: app.address || {},
      contact: {
        phone: app.phone || "",
        whatsapp: app.phone || "",
        email: app.email,
      },
      subscription: {
        plan: "starter_free",
        status: "active",
        startDate: now.toISOString(),
        expiresAt: new Date(now.getTime() + 30 * 86400000).toISOString(),
      },
      limits: {
        productMonthlyLimit: 15,
        maxImagesPerProduct: 5,
      },
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 1. Save store
    const storesCol = getStoresCollection();
    if (storesCol) {
      await storesCol.updateOne(
        { _id: storeId },
        { $set: newStore },
        { upsert: true }
      );
    }

    // 2. Update application status atomically
    const appUpdate = {
      status: "approved",
      storeId,
      reviewedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (appCol) {
      const updateResult = await appCol.updateOne(
        { _id: id, status: "pending" },
        { $set: appUpdate }
      );
      if (updateResult.matchedCount === 0) {
        return res.status(409).json({
          message: "Application was already processed or is no longer pending.",
        });
      }
    } else {
      if (inMemoryApplications.get(id)?.status !== "pending") {
        return res.status(409).json({ message: "Application is no longer pending." });
      }
      inMemoryApplications.set(id, { ...app, ...appUpdate });
    }

    // 3. Update vendor record
    const vendorsCol = getVendorsCollection();
    const vendorUpdate = {
      status: "approved",
      storeId,
      updatedAt: now.toISOString(),
    };

    if (vendorsCol) {
      await vendorsCol.updateOne({ email: app.email }, { $set: vendorUpdate });
    } else {
      await updateVendor(app.email, vendorUpdate);
    }

    // 4. Send approval notification
    await sendVendorApprovalEmail(app.email, {
      storeName: app.storeName,
      slug: app.slug,
      subdomain: app.subdomain,
    });

    return res.status(200).json({
      success: true,
      message: "Vendor application approved successfully. Store created with starter_free plan.",
      store: newStore,
    });
  } catch (error) {
    console.error("approveApplication error:", error);
    return res.status(500).json({ message: "Failed to approve vendor application." });
  }
}

/**
 * POST /api/admin/vendor-applications/:id/reject
 * Admin: Rejects application with required reason.
 */
export async function rejectApplication(req, res) {
  try {
    const { id } = req.params;
    const rawReason = req.body?.reason;

    if (!rawReason || typeof rawReason !== "string" || !rawReason.trim()) {
      return res.status(400).json({
        message: "A rejection reason is required and must be a non-empty string.",
      });
    }

    const reason = rawReason.trim();

    const appCol = getApplicationsCollection();
    let app = null;

    if (appCol) {
      app = await appCol.findOne({ _id: id });
    } else {
      app = inMemoryApplications.get(id);
    }

    if (!app) {
      return res.status(404).json({ message: "Vendor application not found." });
    }

    if (app.status !== "pending") {
      return res.status(409).json({
        message: `Cannot reject application with status '${app.status}'. Only pending applications can be rejected.`,
      });
    }

    const now = new Date().toISOString();
    const appUpdate = {
      status: "rejected",
      rejectionReason: reason,
      reviewedAt: now,
      updatedAt: now,
    };

    if (appCol) {
      const updateResult = await appCol.updateOne(
        { _id: id, status: "pending" },
        { $set: appUpdate }
      );
      if (updateResult.matchedCount === 0) {
        return res.status(409).json({
          message: "Application was already processed or is no longer pending.",
        });
      }
    } else {
      if (inMemoryApplications.get(id)?.status !== "pending") {
        return res.status(409).json({ message: "Application is no longer pending." });
      }
      inMemoryApplications.set(id, { ...app, ...appUpdate });
    }

    // Update vendor record
    const vendorsCol = getVendorsCollection();
    const vendorUpdate = {
      status: "rejected",
      rejectionReason: reason,
      updatedAt: now,
    };

    if (vendorsCol) {
      await vendorsCol.updateOne({ email: app.email }, { $set: vendorUpdate });
    } else {
      await updateVendor(app.email, vendorUpdate);
    }

    // Send rejection notification
    await sendVendorRejectionEmail(app.email, {
      storeName: app.storeName,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: "Vendor application rejected.",
    });
  } catch (error) {
    console.error("rejectApplication error:", error);
    return res.status(500).json({ message: "Failed to reject vendor application." });
  }
}
