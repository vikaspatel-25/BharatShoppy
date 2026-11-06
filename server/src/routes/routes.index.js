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
router.get("/vendor/store/:storeId/subscription", getStoreSubscriptionInfo);
router.post("/vendor/store/:storeId/subscription-request", submitSubscriptionRequest);

// Admin Subscription Control & Verification Desk
router.get("/admin/subscription-requests", getAdminPaymentRequests);
router.post("/admin/subscription-requests/:requestId/verify", verifyPaymentRequest);
router.post("/admin/store/:storeId/renew", adminDirectRenew);
router.post("/admin/store/:storeId/discontinue", adminDirectDiscontinue);

// Isolated Vendor Catalog & Profile Management
router.get("/vendor/store/:storeId", getVendorDashboardData);
router.put("/vendor/store/:storeId", updateVendorProfile);
router.post("/vendor/store/:storeId/products", addVendorProduct);
router.put("/vendor/store/:storeId/products/:productId", updateVendorProduct);
router.delete("/vendor/store/:storeId/products/:productId", deleteVendorProduct);

export default router;
