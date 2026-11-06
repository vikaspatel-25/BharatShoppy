import express from "express";

import { searchLocations } from "../controllers/locationController.js";
import { getProducts } from "../controllers/productController.js";
import { getProductPage } from "../controllers/productPageController.js";
import { globalSearch } from "../controllers/globalSearchController.js";
import getStores from "../controllers/storeController.js";
import { getStorePage } from "../controllers/storePageController.js";
import { searchStoreProducts } from "../controllers/storeProductSearchController.js";
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
} from "../controllers/subscriptionController.js";
import {
  adminLogin,
  adminVerify,
  adminLogout,
} from "../controllers/adminAuthController.js";

import {
  requestOtp,
  verifyOtp,
  vendorLogout,
} from "../controllers/vendorAuthController.js";

import {
  requireAdmin,
  requireVendor,
  requireStoreOwner,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Discovery & Marketplace Routes
router.get("/searchLocations", searchLocations);
router.get("/products", getProducts);
router.get("/products/:productId", getProductPage);
router.get("/stores", getStores);
router.get("/store/:storeId", getStorePage);
router.get("/shop/:storeId", getStorePage);
router.get("/stores/:storeId/products/search", searchStoreProducts);
router.get("/search", globalSearch);

// Multi-Tenant Routing Engine
router.get("/tenant/resolve", resolveTenant);

// Subscription Plans (Public & Vendor)
router.get("/subscription/plans", getSubscriptionPlans);
router.get("/vendor/store/:storeId/subscription", requireVendor, requireStoreOwner, getStoreSubscriptionInfo);
router.post("/vendor/store/:storeId/subscription-request", requireVendor, requireStoreOwner, submitSubscriptionRequest);

// Admin Authentication Desk
router.post("/admin/auth/login", adminLogin);
router.post("/admin/auth/verify", adminVerify);
router.post("/admin/auth/logout", adminLogout);

// Admin Subscription Control & Verification Desk
router.get("/admin/subscription-requests", requireAdmin, getAdminPaymentRequests);
router.post("/admin/subscription-requests/:requestId/verify", requireAdmin, verifyPaymentRequest);
router.post("/admin/store/:storeId/renew", requireAdmin, adminDirectRenew);
router.post("/admin/store/:storeId/discontinue", requireAdmin, adminDirectDiscontinue);

// Vendor Authentication Desk
router.post("/vendor/auth/request-otp", requestOtp);
router.post("/vendor/auth/verify-otp", verifyOtp);
router.post("/vendor/auth/logout", vendorLogout);

// Isolated Vendor Catalog & Profile Management
router.get("/vendor/store/:storeId", requireVendor, requireStoreOwner, getVendorDashboardData);
router.put("/vendor/store/:storeId", requireVendor, requireStoreOwner, updateVendorProfile);
router.post("/vendor/store/:storeId/products", requireVendor, requireStoreOwner, addVendorProduct);
router.put("/vendor/store/:storeId/products/:productId", requireVendor, requireStoreOwner, updateVendorProduct);
router.delete("/vendor/store/:storeId/products/:productId", requireVendor, requireStoreOwner, deleteVendorProduct);

export default router;
