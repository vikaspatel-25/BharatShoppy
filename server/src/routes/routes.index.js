import express from "express";
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

export default router;
