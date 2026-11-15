/**
 * Panel preview API: a fake backend with sample data, so the vendor portal and admin panel
 * can be looked at locally without MongoDB, email or Cloudinary. Development only; it is
 * never deployed and nothing it does is saved.
 *
 * Run, from client/:
 *   npm run preview:panels-api   (listens on 7002, where the Vite dev proxy sends /api)
 *   npm run dev                  (in a second terminal)
 * Then open http://localhost:5173/vendor or http://localhost:5173/admin.
 *
 * Sample data: 10 shops in the admin vendor directory and 10 items in the demo vendor's
 * store (Vastra Handloom House), covering every status the pages show.
 * To see the sign-in pages: open http://localhost:7002/api/__preview/signout, then
 * http://localhost:5173/vendor/login. Any 6 digits work as the code. /api/__preview/signin undoes it.
 * If port 7002 is taken by the real server, stop that first.
 */
import http from "node:http";

const DAY = 86400000;
const iso = (d) => new Date(Date.now() + d * DAY).toISOString();
let signedOut = false; // toggle with GET /api/__preview/signout and /api/__preview/signin

const plans = [
  { planId: "starter_free", name: "Starter Trial Plan", originalPrice: 0, discountedPrice: 0, billingCycle: "Free Trial", badge: "Basic", productMonthlyLimit: 15, maxImagesPerProduct: 5, extraFeatures: ["Direct WhatsApp enquiries", "Basic storefront link"], isActive: true, sortOrder: 1, storesOnPlan: 3 },
  { planId: "yearly_standard", name: "Boutique & Farm Standard", originalPrice: 1800, discountedPrice: 1200, billingCycle: "Per Year", badge: "Popular", isPopular: true, productMonthlyLimit: 50, maxImagesPerProduct: 8, extraFeatures: ["Printable counter QR code", "Your own subdomain storefront"], isActive: true, sortOrder: 2, storesOnPlan: 2 },
  { planId: "yearly_pro", name: "Enterprise & Agri-Hub Pro", originalPrice: 3600, discountedPrice: 2400, billingCycle: "Per Year", badge: "Best Value", productMonthlyLimit: 200, maxImagesPerProduct: 12, extraFeatures: ["Bulk and B2B enquiry mode"], isActive: true, sortOrder: 3, storesOnPlan: 1 },
].map((p) => ({ ...p, features: [`Up to ${p.productMonthlyLimit} active items in your store`, `Up to ${p.maxImagesPerProduct} photos per item`, ...p.extraFeatures], discountPercentage: p.originalPrice > p.discountedPrice ? Math.round(((p.originalPrice - p.discountedPrice) / p.originalPrice) * 100) : 0 }));

const store = {
  _id: "store_demo", storeName: "Vastra Handloom House", slug: "vastra", subdomain: "vastra", entityType: "shopkeeper",
  description: "Hand-block printed cotton kurtis and sarees from Jaipur.", contact: { phone: "+919876543210", whatsapp: "+919876543210" },
  address: { area: "Bapu Bazaar", city: "Jaipur", state: "Rajasthan" }, metadata: { specialty: "Hand-block prints" },
  subscription: { plan: "yearly_standard", status: "active", startDate: iso(-345), expiresAt: iso(20) }, limits: { productMonthlyLimit: 50, maxImagesPerProduct: 8 }, isActive: true,
};
const item = (id, productName, category, min, max, unit, extra = {}) => ({ _id: id, storeId: "store_demo", productName, category, price: { min, max, unit }, images: [], isActive: true, inStock: true, ...extra });
const products = [
  item("p1", "Hand-block printed cotton kurti, indigo", "Apparel & Fashion", 899, 1199, "piece"),
  item("p2", "Sanganeri print cotton saree with blouse piece, a deliberately long name to show two-line clamping on small screens", "Apparel & Fashion", 2499, 2499, "piece", { inStock: false }),
  item("p3", "Bagru dabu dupatta", "Apparel & Fashion", 650, 650, "piece", { isActive: false }),
  item("p4", "Kids' cotton frock", "Apparel & Fashion", 450, 450, "piece", { moderation: { status: "hidden", reason: "The photos show a different product.", hiddenAt: iso(-2) } }),
  item("p5", "Kalamkari cotton fabric", "Apparel & Fashion", 220, 260, "meter"),
  item("p6", "Block-print bedsheet set with two pillow covers", "Home & Garden", 1499, 1899, "set"),
  item("p7", "Mojari leather juttis", "Apparel & Fashion", 799, 999, "pair"),
  item("p8", "Cotton palazzo pants", "Apparel & Fashion", 549, 549, "piece", { isActive: false }),
  item("p9", "Hand-printed table runner", "Furniture & Home Decor", 399, 499, "piece"),
  item("p10", "Gift pack: three cotton handkerchiefs", "Handicrafts & Art", 299, 299, "pack"),
];
const requests = [
  { _id: "req_1", requestId: "req_1", storeId: "store_demo", storeName: "Vastra Handloom House", vendorEmail: "vastra@example.com", planId: "yearly_standard", selectedPlan: "yearly_standard", planName: "Boutique & Farm Standard", amount: 1200, discountedPrice: 1200, vendorNote: "Will pay by bank transfer on Monday.", status: "pending", createdAt: iso(-1) },
  { _id: "req_2", requestId: "req_2", storeId: "store_farm", storeName: "Green Valley Farms", vendorEmail: "farm@example.com", planId: "yearly_pro", selectedPlan: "yearly_pro", planName: "Enterprise & Agri-Hub Pro", amount: 2400, discountedPrice: 2400, status: "approved", durationDays: 365, activatedExpiresAt: iso(300), verifiedAt: iso(-65), createdAt: iso(-66) },
  { _id: "req_3", requestId: "req_3", storeId: "store_fix", storeName: "Sharma Electricals", vendorEmail: "sharma@example.com", planId: "yearly_standard", selectedPlan: "yearly_standard", planName: "Boutique & Farm Standard", amount: 1200, discountedPrice: 1200, status: "rejected", rejectionReason: "Payment could not be confirmed.", adminNotes: "Payment could not be confirmed.", createdAt: iso(-10) },
];
const applications = [
  { _id: "app_1", name: "Meera Iyer", email: "meera@example.com", phone: "+919811112222", storeName: "Meera's Millet Kitchen", slug: "meera-millets", subdomain: "meera-millets", entityType: "farmer", storeCategory: "Retail & General", description: "Organic millet flours and snacks.", address: { city: "Mysuru", state: "Karnataka" }, status: "pending", createdAt: iso(-0.2) },
  { _id: "app_2", name: "Ravi Kumar", email: "ravi@example.com", phone: "+919833334444", storeName: "Ravi Tailoring Studio", slug: "ravi-tailors", subdomain: "ravi-tailors", entityType: "service_provider", description: "Alterations and custom stitching.", address: { city: "Pune", state: "Maharashtra" }, status: "pending", createdAt: iso(-1.5) },
  { _id: "app_3", name: "Anil Shah", email: "anil@example.com", storeName: "Shah Kirana", slug: "shah-kirana", subdomain: "shah-kirana", entityType: "shopkeeper", status: "rejected", rejectionReason: "Store details were incomplete.", reviewedAt: iso(-3), createdAt: iso(-5) },
];
const shop = (n, storeName, slug, entityType, city, planId, status, days, activeItems, extra = {}) => {
  const plan = plans.find((p) => p.planId === planId);
  return {
    vendorId: extra.noVendor ? null : `v${n}`, storeId: n === 1 ? "store_demo" : `store_${slug}`, storeName, slug, subdomain: slug,
    email: extra.noVendor ? null : `${slug}@example.com`, phone: "+9198765432" + String(n).padStart(2, "0"), whatsapp: "+9198765432" + String(n).padStart(2, "0"),
    entityType, city, planId, planName: plan ? plan.name : null, computedStatus: status,
    isExpiringSoon: status === "active" && days <= 30, remainingDays: status === "active" ? days : 0,
    expiresAt: days == null ? null : iso(days), activeItems, itemLimit: plan ? plan.productMonthlyLimit : 50, removalDaysLeft: 0, ...extra,
  };
};
const vendors = [
  shop(1, "Vastra Handloom House", "vastra", "shopkeeper", "Jaipur", "yearly_standard", "active", 20, 8),
  shop(2, "Green Valley Farms", "green-valley", "farmer", "Nashik", "yearly_pro", "active", 300, 42),
  shop(3, "Sharma Electricals", "sharma-electricals", "service_provider", "Indore", "starter_free", "expired", -12, 6),
  shop(4, "Old Town Sweets", "old-town-sweets", "shopkeeper", "Lucknow", "starter_free", "removal_hold", 5, 0, { removalDaysLeft: 4, deleteAfter: iso(4) }),
  shop(5, "Demo Store (no vendor account)", "demo", "shopkeeper", "Delhi", null, "none", null, 10, { noVendor: true }),
  shop(6, "Meenakshi Spices", "meenakshi-spices", "farmer", "Madurai", "yearly_standard", "active", 9, 31),
  shop(7, "Kolkata Book Corner", "kolkata-books", "shopkeeper", "Kolkata", "yearly_standard", "active", 180, 47),
  shop(8, "Ravi Tailoring Studio", "ravi-tailors", "service_provider", "Pune", "starter_free", "active", 25, 12),
  shop(9, "Himalayan Apple Orchards", "himalayan-apples", "farmer", "Shimla", "yearly_pro", "expired", -40, 0),
  shop(10, "Coastal Cane Furniture", "coastal-cane", "shopkeeper", "Kochi", "yearly_pro", "active", 240, 120),
];
const audit = [
  { _id: "a1", action: "plan_request.approve", targetType: "store", targetId: "store_farm", targetName: "Green Valley Farms", actorEmail: "admin@example.com", ipAddress: "127.0.0.1", details: { planName: "Enterprise & Agri-Hub Pro", durationDays: 365, emailFailed: false }, createdAt: iso(-65) },
  { _id: "a2", action: "listing.hide", targetType: "listing", targetId: "p4", targetName: "Kids' cotton frock", actorEmail: "admin@example.com", ipAddress: "127.0.0.1", details: { storeName: "Vastra Handloom House", reason: "The photos show a different product." }, createdAt: iso(-2) },
  { _id: "a3", action: "vendor.remove", targetType: "vendor", targetId: "v4", targetName: "Old Town Sweets", actorEmail: "admin@example.com", ipAddress: "127.0.0.1", details: { items: 8, photos: 14 }, createdAt: iso(-3) },
  { _id: "a4", action: "application.reject", targetType: "application", targetId: "app_3", targetName: "Shah Kirana", actorEmail: "admin@example.com", ipAddress: "127.0.0.1", details: { reason: "Store details were incomplete." }, createdAt: iso(-3) },
];
const notifications = [
  { _id: "n1", type: "vendor_application", title: "New application", message: "Meera's Millet Kitchen applied to sell.", link: "/admin/applications", read: false, createdAt: iso(-0.2) },
  { _id: "n2", type: "plan_request", title: "New plan request", message: "Vastra Handloom House asked for Boutique & Farm Standard.", link: "/admin/plan-requests", read: false, createdAt: iso(-1) },
  { _id: "n3", type: "store_renamed", title: "Store renamed", message: '"Sharma Electric" is now "Sharma Electricals".', link: "/admin/vendors", read: true, createdAt: iso(-8) },
];

const ok = { success: true, message: "Done (preview only, nothing was saved)." };
const subInfo = () => ({
  subscription: { ...store.subscription, computedStatus: "active", remainingDays: 20, isExpiringSoon: true, planName: "Boutique & Farm Standard" },
  limits: { productMonthlyLimit: 50, maxImagesPerProduct: 8, currentProductCount: products.filter((p) => p.isActive !== false).length },
  recentRequests: requests.filter((r) => r.storeId === "store_demo"),
});
const counts = (rows) => ({ pending: rows.filter((r) => r.status === "pending").length, approved: rows.filter((r) => r.status === "approved").length, rejected: rows.filter((r) => r.status === "rejected").length, total: rows.length });
const totals = () => {
  const t = { all: vendors.length, active: 0, expiring: 0, expired: 0, none: 0, removal_hold: 0 };
  vendors.forEach((v) => { t[v.computedStatus] += 1; if (v.isExpiringSoon) t.expiring += 1; });
  return t;
};

function route(method, url, body) {
  const u = new URL(url, "http://x");
  const p = u.pathname;
  const q = u.searchParams;
  if (p === "/api/__preview/signout") { signedOut = true; return [200, { signedOut }]; }
  if (p === "/api/__preview/signin") { signedOut = false; return [200, { signedOut }]; }
  if (p === "/api/subscription/plans") return [200, { plans }];
  if (p === "/api/vendor/auth/me") return signedOut ? [401, { message: "Not signed in" }] : [200, { vendor: { _id: "v1", email: "vastra@example.com", storeId: "store_demo", status: "approved" } }];
  if (p === "/api/admin/auth/me") return signedOut ? [401, { message: "Not signed in" }] : [200, { admin: { email: "admin@example.com" } }];
  if (p.endsWith("/auth/logout")) { signedOut = true; return [200, ok]; }
  if (p.endsWith("/auth/request-code") || p === "/api/vendor/apply/request-code") return [200, { message: "If registered, a verification code was sent to your email. (Preview: use any 6 digits.)" }];
  if (p === "/api/admin/auth/login") return [200, { tempToken: "preview", message: "A 6-digit 2FA code has been sent to your admin email. (Preview: use any 6 digits.)" }];
  if (p.endsWith("/auth/verify-code") || p === "/api/admin/auth/verify") { signedOut = false; return [200, ok]; }
  if (p === "/api/vendor/apply") return [201, { message: "Application submitted (preview)." }];

  if (p === "/api/vendor/store/store_demo" && method === "GET") return [200, { store, products, stats: {} }];
  if (p === "/api/vendor/store/store_demo" && method === "PUT") { Object.assign(store, { storeName: body.storeName, description: body.description, entityType: body.entityType, contact: body.contact, address: body.address, metadata: body.metadata }); return [200, { message: "Saved", store }]; }
  if (p === "/api/vendor/store/store_demo/subscription") return [200, subInfo()];
  if (p === "/api/vendor/store/store_demo/subscription-request") return [409, { message: "A subscription request is already pending approval for this store." }];
  if (p === "/api/vendor/store/store_demo/media/sign") return [503, { message: "Photo upload is off in this preview." }];
  if (p === "/api/vendor/store/store_demo/products" && method === "POST") { const prod = { ...body, _id: `p${Date.now()}`, storeId: "store_demo" }; products.unshift(prod); return [201, { product: prod }]; }
  const pm = p.match(/^\/api\/vendor\/store\/store_demo\/products\/([^/]+)$/);
  if (pm && method === "PUT") { const prod = products.find((x) => x._id === pm[1]); if (!prod) return [404, { message: "Product not found" }]; Object.assign(prod, body); return [200, { product: prod }]; }

  if (p === "/api/admin/overview") return [200, { applicationsWaiting: applications.filter((a) => a.status === "pending").length, planRequestsWaiting: requests.filter((r) => r.status === "pending").length, activeItems: vendors.reduce((n, v) => n + v.activeItems, 0), hiddenItems: products.filter((x) => x.moderation?.status === "hidden").length, stores: totals() }];
  if (p === "/api/admin/vendors") {
    const status = q.get("status") || "all"; const s = (q.get("search") || "").toLowerCase();
    const rows = vendors.filter((v) => (status === "all" || (status === "expiring" ? v.isExpiringSoon : v.computedStatus === status)) && (!s || `${v.storeName} ${v.slug} ${v.email}`.toLowerCase().includes(s)));
    return [200, { vendors: rows, total: rows.length, totals: totals(), skip: 0, limit: 25 }];
  }
  if (/^\/api\/admin\/vendors\/[^/]+\/removal-impact$/.test(p)) return [200, { impact: { items: 8, photos: 14 } }];
  if (p === "/api/admin/notifications") return [200, { notifications, unreadCount: notifications.filter((n) => !n.read).length }];
  if (p === "/api/admin/vendor-applications") return [200, { applications }];
  if (p === "/api/admin/subscription-requests") return [200, { requests, counts: counts(requests) }];
  if (p === "/api/admin/listings") {
    const state = q.get("state"); const s = (q.get("search") || "").toLowerCase();
    const rows = products.map((x) => ({ productId: x._id, productName: x.productName, image: null, price: x.price, category: x.category, storeId: "store_demo", storeName: "Vastra Handloom House", storeSlug: "vastra", vendorActive: x.isActive !== false, hidden: x.moderation?.status === "hidden", moderation: x.moderation || null }))
      .filter((r) => (!state || (state === "hidden" ? r.hidden : !r.hidden)) && (!s || r.productName.toLowerCase().includes(s)));
    return [200, { listings: rows, total: rows.length, skip: 0, limit: 25 }];
  }
  if (p === "/api/admin/audit-log") {
    const action = q.get("action");
    const rows = audit.filter((e) => !action || e.action === action);
    return [200, { entries: rows, total: rows.length, page: 1, limit: 25, totalPages: 1 }];
  }
  if (p === "/api/admin/plans" && method === "GET") return [200, { plans }];
  if (method !== "GET") return [200, ok]; // every other admin action "succeeds" without changing anything
  return [404, { message: "Not in the preview API" }];
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
      const [status, data] = route(req.method, req.url, body);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    });
  })
  .listen(7002, () => console.log("Preview API on http://localhost:7002"));
