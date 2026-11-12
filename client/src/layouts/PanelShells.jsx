import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PanelLayout from "./PanelLayout";
import { ADMIN_NAV, VENDOR_NAV } from "@/routes/panelRoutes";
import { AdminSessionProvider, VendorSessionProvider, useVendorSession } from "@/context/PanelSession";
import { getTenantStoreUrl } from "@/lib/domainUtils";
import { apiFetch } from "@/lib/apiClient";
import NotificationBell from "@/components/admin/NotificationBell";

/** Vendor portal: session first, then the shell around the current page. */
export function VendorArea() {
  return (
    <VendorSessionProvider>
      <VendorShell />
    </VendorSessionProvider>
  );
}

function VendorShell() {
  const { store } = useVendorSession();
  const storeUrl = store ? getTenantStoreUrl(store) : "";
  return (
    <PanelLayout
      portalName="Vendor portal"
      nav={VENDOR_NAV}
      logoutUrl="/api/vendor/auth/logout"
      loginPath="/vendor/login"
      siteLink={storeUrl ? { href: storeUrl, label: "View store" } : null}
    >
      <Outlet />
    </PanelLayout>
  );
}

/** Admin panel: session first, then the shell with count badges and the notification bell. */
export function AdminArea() {
  return (
    <AdminSessionProvider>
      <AdminShell />
    </AdminSessionProvider>
  );
}

function AdminShell() {
  const { pathname } = useLocation();
  const [badges, setBadges] = useState({});

  // Refresh the counts on every page change, so they don't go stale after a queue is cleared
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/admin/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setBadges({ applicationsWaiting: data.applicationsWaiting || 0, planRequestsWaiting: data.planRequestsWaiting || 0 });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <PanelLayout
      portalName="Admin"
      nav={ADMIN_NAV}
      badges={badges}
      logoutUrl="/api/admin/auth/logout"
      loginPath="/admin/login"
      siteLink={{ href: "/", label: "View site" }}
      headerExtras={<NotificationBell />}
    >
      <Outlet />
    </PanelLayout>
  );
}
