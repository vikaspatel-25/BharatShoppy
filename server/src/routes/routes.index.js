import express from "express";
import { listAdminPlans, updateAdminPlan } from "../controllers/adminPlanController.js";
import { runSampleData } from "../controllers/maintenanceController.js";
import { searchLocations } from "../controllers/locationController.js";
import { getProducts } from "../controllers/productController.js";
import { getProductPage } from "../controllers/productPageController.js";
import getStores from "../controllers/storeController.js";
import { getStorePage } from "../controllers/storePageController.js";
import { searchStoreProducts } from "../controllers/storeProductSearchController.js";
import { globalSearch } from "../controllers/globalSearchController.js";
import { resolveTenant } from "../controllers/tenantController.js";
import {
  getVendorDashboardData,
  updateVendorProfile,
  addVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
} from "../controllers/vendorCatalogController.js";
import { signMediaUpload } from "../controllers/mediaSignController.js";

import {
  getSubscriptionPlans,
  getStoreSubscriptionInfo,
  submitSubscriptionRequest,
  getAdminPaymentRequests,
  verifyPaymentRequest,
  adminDirectRenew,
  adminDirectDiscontinue,
  sendAdminRenewalReminder,
  resendSubscriptionEmail,
} from "../controllers/subscriptionController.js";
import {
  adminLogin,
  adminVerify,
  adminLogout,
} from "../controllers/adminAuthController.js";

import {
  requestCode,
  verifyCode,
  vendorLogout,
} from "../controllers/vendorAuthController.js";

import {
  requestApplicationCode,
  submitApplication,
  listApplications,
  approveApplication,
  rejectApplication,
  resendApplicationEmail,
} from "../controllers/vendorApplicationController.js";

import {
  removeVendor,
  cancelVendorRemoval,
  cleanupRemovedVendors,
} from "../controllers/adminVendorRemovalController.js";

import {
  getAdminMe,
  listVendorDirectory,
  getVendorRemovalImpact,
  getAdminOverview,
} from "../controllers/adminPanelController.js";
import {
  getAuditLog,
  getNotifications,
  markNotificationRead,
} from "../controllers/adminActivityController.js";
import { listListings, hideListing, restoreListing } from "../controllers/adminListingController.js";

import {
  requireAdmin,
  requireVendor,
  requireStoreOwner,
} from "../middleware/authMiddleware.js";
import { searchRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Public Discovery & Marketplace Routes
router.get("/searchLocations", searchRateLimiter, searchLocations);
router.get("/products", getProducts);
router.get("/products/:productId", getProductPage);
router.get("/stores", getStores);
router.get("/store/:storeId", getStorePage);
router.get("/shop/:storeId", getStorePage);
router.get("/stores/:storeId/products/search", searchRateLimiter, searchStoreProducts);
router.get("/search", searchRateLimiter, globalSearch);

// Multi-Tenant Routing Engine
router.get("/tenant/resolve", resolveTenant);

// Subscription Plans (Public & Vendor)
router.get("/subscription/plans", getSubscriptionPlans);
router.get("/vendor/store/:storeId/subscription", requireVendor, requireStoreOwner, getStoreSubscriptionInfo);
router.post("/vendor/store/:storeId/subscription-request", requireVendor, requireStoreOwner, submitSubscriptionRequest);

// Vendor Application & Onboarding
router.post("/vendor/apply/request-code", requestApplicationCode);
router.post("/vendor/apply", submitApplication);

// Admin Authentication Desk
router.post("/admin/auth/login", adminLogin);
router.post("/admin/auth/verify", adminVerify);
router.post("/admin/auth/logout", adminLogout);
router.get("/admin/auth/me", requireAdmin, getAdminMe);

// Admin panel data: dashboard totals, vendor directory, removal impact
router.get("/admin/overview", requireAdmin, getAdminOverview);
router.get("/admin/vendors", requireAdmin, listVendorDirectory);
router.get("/admin/vendors/:vendorId/removal-impact", requireAdmin, getVendorRemovalImpact);

// Admin audit log and notifications
router.get("/admin/audit-log", requireAdmin, getAuditLog);
router.get("/admin/notifications", requireAdmin, getNotifications);
router.post("/admin/notifications/mark-read", requireAdmin, markNotificationRead);

// Admin listing moderation: hide with a reason, restore
router.get("/admin/listings", requireAdmin, listListings);
router.post("/admin/listings/:productId/hide", requireAdmin, hideListing);
router.post("/admin/listings/:productId/restore", requireAdmin, restoreListing);

// Admin plan editor: plans are edited and switched off, never created or deleted here
router.get("/admin/plans", requireAdmin, listAdminPlans);
router.put("/admin/plans/:planId", requireAdmin, updateAdminPlan);

// Admin Subscription Control & Verification Desk
router.get("/admin/subscription-requests", requireAdmin, getAdminPaymentRequests);
router.post("/admin/subscription-requests/:requestId/verify", requireAdmin, verifyPaymentRequest);
router.post("/admin/store/:storeId/renew", requireAdmin, adminDirectRenew);
router.post("/admin/store/:storeId/discontinue", requireAdmin, adminDirectDiscontinue);
router.post("/admin/store/:storeId/send-renewal-reminder", requireAdmin, sendAdminRenewalReminder);
router.post("/admin/store/:storeId/resend-subscription-email", requireAdmin, resendSubscriptionEmail);

// Admin Vendor Applications Management Desk
router.get("/admin/vendor-applications", requireAdmin, listApplications);
router.post("/admin/vendor-applications/:id/approve", requireAdmin, approveApplication);
router.post("/admin/vendor-applications/:id/reject", requireAdmin, rejectApplication);
router.post("/admin/vendor-applications/:id/resend-email", requireAdmin, resendApplicationEmail);

// Admin Vendor Removal & 7-Day Hold Control
router.post("/admin/vendors/:vendorId/remove", requireAdmin, removeVendor);
router.post("/admin/vendors/:vendorId/cancel-removal", requireAdmin, cancelVendorRemoval);

// Sample data: switched off unless SAMPLE_DATA_SECRET is set (404 otherwise)
router.post("/maintenance/sample-data", runSampleData);

// Secured Cron: Cleanup removed vendors after 7-day hold
router.get("/cron/cleanup-removed-vendors", cleanupRemovedVendors);
router.post("/cron/cleanup-removed-vendors", cleanupRemovedVendors);

// Vendor Authentication Desk
router.post("/vendor/auth/request-code", requestCode);
router.post("/vendor/auth/verify-code", verifyCode);
router.post("/vendor/auth/logout", vendorLogout);
router.get("/vendor/auth/me", requireVendor, (req, res) => {
  return res.json({
    vendor: {
      _id: req.vendor.vendorId,
      email: req.vendor.email,
      storeId: req.vendor.storeId,
      status: req.vendor.status,
    },
  });
});

// Isolated Vendor Catalog & Profile Management
router.get("/vendor/store/:storeId", requireVendor, requireStoreOwner, getVendorDashboardData);
router.put("/vendor/store/:storeId", requireVendor, requireStoreOwner, updateVendorProfile);
router.post("/vendor/store/:storeId/products", requireVendor, requireStoreOwner, addVendorProduct);
router.put("/vendor/store/:storeId/products/:productId", requireVendor, requireStoreOwner, updateVendorProduct);
router.delete("/vendor/store/:storeId/products/:productId", requireVendor, requireStoreOwner, deleteVendorProduct);
router.post("/vendor/store/:storeId/media/sign", requireVendor, requireStoreOwner, signMediaUpload);

export default router;
