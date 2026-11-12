/**
 * Route and navigation table for the vendor portal and the admin panel.
 * Plain data with no JSX, so tests can import it and the sidebar, the routes and the
 * browser tab titles all come from one place.
 *
 * Icons are lucide-react names, mapped to components in PanelLayout.
 */

export const VENDOR_NAV = [
  {
    heading: "Overview",
    items: [{ to: "/vendor", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    heading: "Catalogue",
    items: [
      { to: "/vendor/items", label: "Items", icon: "Package" },
      { to: "/vendor/items/new", label: "Add item", icon: "PlusCircle" },
    ],
  },
  {
    heading: "Account",
    items: [
      { to: "/vendor/store", label: "Store profile", icon: "Store" },
      { to: "/vendor/plan", label: "Plan and usage", icon: "CreditCard" },
    ],
  },
];

export const ADMIN_NAV = [
  {
    heading: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    heading: "Vendors",
    items: [
      { to: "/admin/applications", label: "Applications", icon: "UserCheck", badgeKey: "applicationsWaiting" },
      { to: "/admin/vendors", label: "Vendor directory", icon: "Users" },
    ],
  },
  {
    heading: "Plans",
    items: [
      { to: "/admin/plan-requests", label: "Plan requests", icon: "Layers", badgeKey: "planRequestsWaiting" },
      { to: "/admin/plans", label: "Plans and limits", icon: "Percent" },
    ],
  },
  {
    heading: "Catalogue",
    items: [{ to: "/admin/listings", label: "Listings", icon: "Package" }],
  },
  {
    heading: "Records",
    items: [{ to: "/admin/audit-log", label: "Audit log", icon: "History" }],
  },
];

/** Pages that exist but aren't in the sidebar, with the label shown in the header and tab title. */
const EXTRA_PAGES = [
  { pattern: /^\/vendor\/items\/[^/]+$/, label: "Edit item", area: "vendor" },
];

export const VENDOR_PATHS = ["/vendor", "/vendor/items", "/vendor/items/new", "/vendor/items/:productId", "/vendor/store", "/vendor/plan"];
export const ADMIN_PATHS = ["/admin", "/admin/applications", "/admin/vendors", "/admin/plan-requests", "/admin/plans", "/admin/listings", "/admin/audit-log"];

/**
 * Which panel and sign-in paths a host serves. A tenant subdomain serves the vendor portal
 * and vendor sign-in only; the admin panel and the application form live on the marketplace.
 */
export function getPanelRoutes({ tenant }) {
  return {
    vendor: [...VENDOR_PATHS],
    admin: tenant ? [] : [...ADMIN_PATHS],
    auth: tenant ? ["/vendor/login"] : ["/vendor/login", "/vendor/apply", "/admin/login"],
  };
}

function normalise(pathname) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/** True for any vendor or admin page, including sign-in, where the marketplace header is hidden. */
export function isPanelPath(pathname) {
  const p = normalise(pathname);
  return p === "/vendor" || p.startsWith("/vendor/") || p === "/admin" || p.startsWith("/admin/") || p === "/manage";
}

export function getPanelArea(pathname) {
  const p = normalise(pathname);
  if (p === "/admin" || p.startsWith("/admin/")) return "admin";
  if (p === "/vendor" || p.startsWith("/vendor/")) return "vendor";
  return null;
}

/** The nav item or extra page that matches a path, or null. */
export function findPanelPage(pathname) {
  const p = normalise(pathname);
  const nav = getPanelArea(p) === "admin" ? ADMIN_NAV : VENDOR_NAV;
  const item = nav.flatMap((g) => g.items).find((i) => i.to === p);
  if (item) return item;
  const extra = EXTRA_PAGES.find((e) => e.pattern.test(p));
  return extra ? { to: p, label: extra.label } : null;
}

const AUTH_TITLES = {
  "/vendor/login": "Vendor sign in",
  "/vendor/apply": "Apply to sell",
  "/admin/login": "Admin sign in",
};

/** Browser tab title, for example "Items · Vendor portal | BharatShopy". */
export function getPanelTitle(pathname) {
  const p = normalise(pathname);
  if (AUTH_TITLES[p]) return `${AUTH_TITLES[p]} | BharatShopy`;
  const area = getPanelArea(p);
  const page = findPanelPage(p);
  if (!area || !page) return "BharatShopy";
  return `${page.label} · ${area === "admin" ? "Admin" : "Vendor portal"} | BharatShopy`;
}
