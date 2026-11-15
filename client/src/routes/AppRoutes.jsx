import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Header from "../components/layout/header/header.jsx";
import { getTenantSubdomain } from "../lib/domainUtils.js";
import { getPanelTitle, isPanelPath } from "./panelRoutes.js";
import { LoadingState } from "../components/panel/ui.jsx";
import { AdminArea, VendorArea } from "../layouts/PanelShells.jsx";

// Every page loads on demand, so shoppers don't download the panels and vendors don't download the admin panel.
const Home = lazy(() => import("../pages/home.jsx"));
const Product = lazy(() => import("../pages/product.jsx"));
const Store = lazy(() => import("../pages/store.jsx"));
const Search = lazy(() => import("../pages/search.jsx"));
const VendorLogin = lazy(() => import("../pages/VendorLogin.jsx"));
const VendorApply = lazy(() => import("../pages/VendorApply.jsx"));
const AdminLogin = lazy(() => import("../pages/AdminLogin.jsx"));

// Old single-page admin panel, kept at /admin until P7 replaces it
const LegacyAdminDashboard = lazy(() => import("../pages/AdminDashboard.jsx"));

const VendorHome = lazy(() => import("../pages/vendor/VendorHome.jsx"));
const VendorItems = lazy(() => import("../pages/vendor/VendorItems.jsx"));
const VendorItemEditor = lazy(() => import("../pages/vendor/VendorItemEditor.jsx"));
const VendorStore = lazy(() => import("../pages/vendor/VendorStore.jsx"));
const VendorPlan = lazy(() => import("../pages/vendor/VendorPlan.jsx"));

const AdminApplications = lazy(() => import("../pages/admin/AdminApplications.jsx"));
const AdminVendors = lazy(() => import("../pages/admin/AdminVendors.jsx"));
const AdminPlanRequests = lazy(() => import("../pages/admin/AdminPlanRequests.jsx"));
const AdminPlans = lazy(() => import("../pages/admin/AdminPlans.jsx"));
const AdminListings = lazy(() => import("../pages/admin/AdminListings.jsx"));
const AdminAuditLog = lazy(() => import("../pages/admin/AdminAuditLog.jsx"));

function TitleUpdater() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (isPanelPath(pathname)) document.title = getPanelTitle(pathname);
  }, [pathname]);
  return null;
}

const pageFallback = <LoadingState />;

/** Vendor portal routes, served on the marketplace host and on tenant subdomains. */
function vendorRoutes() {
  return (
    <>
      <Route element={<VendorArea />}>
        <Route path="/vendor" element={<VendorHome />} />
        <Route path="/vendor/items" element={<VendorItems />} />
        <Route path="/vendor/items/new" element={<VendorItemEditor />} />
        <Route path="/vendor/items/:productId" element={<VendorItemEditor />} />
        <Route path="/vendor/store" element={<VendorStore />} />
        <Route path="/vendor/plan" element={<VendorPlan />} />
      </Route>
      <Route path="/vendor/login" element={<VendorLogin />} />
      <Route path="/manage" element={<Navigate to="/vendor" replace />} />
    </>
  );
}

function AppRoutes() {
  const [tenantSubdomain] = useState(() => getTenantSubdomain());
  const { pathname } = useLocation();

  // Tenant subdomain: the store's own site plus its vendor portal. No marketplace header, no admin panel.
  if (tenantSubdomain) {
    return (
      <Suspense fallback={pageFallback}>
        <TitleUpdater />
        <Routes>
          <Route path="/" element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />} />
          <Route path="/shop" element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />} />
          <Route path="/store" element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />} />
          <Route path="/product/:productId" element={<Product isolated={true} />} />
          {vendorRoutes()}
          <Route path="*" element={<Store isolated={true} tenantSubdomain={tenantSubdomain} />} />
        </Routes>
      </Suspense>
    );
  }

  // Marketplace host: the public site, the vendor portal and the admin panel
  return (
    <>
      <TitleUpdater />
      {!isPanelPath(pathname) && <Header />}
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:productId" element={<Product />} />
          <Route path="/store/:storeId" element={<Store />} />
          <Route path="/shop/:storeId" element={<Store isolated={true} />} />

          {vendorRoutes()}
          <Route path="/vendor/apply" element={<VendorApply />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<LegacyAdminDashboard />} />
          <Route element={<AdminArea />}>
            <Route path="/admin/applications" element={<AdminApplications />} />
            <Route path="/admin/vendors" element={<AdminVendors />} />
            <Route path="/admin/plan-requests" element={<AdminPlanRequests />} />
            <Route path="/admin/plans" element={<AdminPlans />} />
            <Route path="/admin/listings" element={<AdminListings />} />
            <Route path="/admin/audit-log" element={<AdminAuditLog />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default AppRoutes;
