import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "../pages/home.jsx";
import Product from "../pages/product.jsx";
import Store from "../pages/store.jsx";
import Search from "../pages/search.jsx";
import VendorDashboard from "../pages/vendorDashboard.jsx";
import Header from "../components/layout/header/header.jsx";
import { getTenantSubdomain } from "../lib/domainUtils.js";

function AppRoutes() {
  const [tenantSubdomain] = useState(() => getTenantSubdomain());

  // Subdomain / Isolated Tenant Mode: Strict boundary, suppress marketplace header
  if (tenantSubdomain) {
    return (
      <Routes>
        <Route
          path="/"
          element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />}
        />
        <Route
          path="/shop"
          element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />}
        />
        <Route
          path="/store"
          element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />}
        />
        <Route path="/product/:productId" element={<Product isolated={true} />} />
        <Route path="/manage" element={<VendorDashboard />} />
        <Route path="/vendor" element={<VendorDashboard />} />
        <Route
          path="/admin"
          element={
            <VendorDashboard defaultTab="subscription" defaultShowAdmin={true} />
          }
        />
        <Route
          path="*"
          element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />}
        />
      </Routes>
    );
  }

  // Central Marketplace Mode (Standard BharatShoppy domain)
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/product/:productId" element={<Product />} />
        {/* Standard Store View */}
        <Route path="/store/:storeId" element={<Store />} />
        {/* Dedicated / Path-Based Isolated Store View */}
        <Route path="/shop/:storeId" element={<Store isolated={true} />} />
        {/* Vendor Management Dashboard & Product Upload */}
        <Route path="/vendor" element={<VendorDashboard />} />
        <Route path="/vendor/:storeId" element={<VendorDashboard />} />
        {/* Admin Operations & Subscription Desk */}
        <Route
          path="/admin"
          element={
            <VendorDashboard defaultTab="subscription" defaultShowAdmin={true} />
          }
        />
        <Route
          path="/admin/:storeId"
          element={
            <VendorDashboard defaultTab="subscription" defaultShowAdmin={true} />
          }
        />
      </Routes>
    </>
  );
}

export default AppRoutes;
