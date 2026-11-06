/**
 * Multi-Tenant Domain & Subdomain Utilities for BharatShopy
 * Handles wildcard subdomains (*.bharatshopy.com, *.localhost, *.lvh.me)
 * and path-based routing (/shop/:id) with strict context isolation.
 */

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "cdn",
  "staging",
  "preview",
  "bharatshopy",
]);

/**
 * Extracts tenant subdomain from a given hostname or window.location.hostname
 * Supports:
 * - Production: "vastra-heritage.bharatshopy.com" -> "vastra-heritage"
 * - Localhost dev: "vastra-heritage.localhost" -> "vastra-heritage"
 * - lvh.me dev: "vastra-heritage.lvh.me" -> "vastra-heritage"
 * - Query parameter fallback for easy testing on standard localhost:5173:
 *   "localhost:5173/?tenant=vastra-heritage" -> "vastra-heritage"
 */
export function getTenantSubdomain(hostnameOverride) {
  if (!hostnameOverride && typeof window === "undefined") {
    return null;
  }

  // Check URL query override (?tenant=slug) for local dev testing
  if (typeof window !== "undefined" && window.location?.search) {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTenant = urlParams.get("tenant");
    if (queryTenant && queryTenant.trim()) {
      return queryTenant.trim().toLowerCase();
    }
  }

  const host = (
    hostnameOverride ||
    (typeof window !== "undefined" ? window.location.hostname : "") ||
    ""
  )
    .trim()
    .toLowerCase();

  const cleanHost = host.split(":")[0];

  // Ignore bare IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost)) {
    return null;
  }

  // Handle localhost subdomains: "shop.localhost"
  if (cleanHost.endsWith(".localhost")) {
    const parts = cleanHost.split(".");
    if (parts.length >= 2 && !RESERVED_SUBDOMAINS.has(parts[0])) {
      return parts[0];
    }
    return null;
  }

  // Handle lvh.me subdomains: "shop.lvh.me"
  if (cleanHost.endsWith(".lvh.me")) {
    const parts = cleanHost.split(".");
    if (parts.length >= 3 && !RESERVED_SUBDOMAINS.has(parts[0])) {
      return parts[0];
    }
    return null;
  }

  const parts = cleanHost.split(".");
  // Normal domains need at least 3 parts for a subdomain: tenant.domain.tld
  if (parts.length >= 3) {
    const candidate = parts[0];
    if (!RESERVED_SUBDOMAINS.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Checks if the current page should be rendered in Isolated Tenant mode.
 * True when running on a tenant subdomain, when "?isolated=true" is set,
 * or when accessing via dedicated /shop/ path.
 */
export function isIsolatedTenantMode() {
  if (typeof window === "undefined") return false;

  const subdomain = getTenantSubdomain();
  if (subdomain) return true;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("isolated") === "true") return true;

  if (window.location.pathname.startsWith("/shop/")) return true;

  return false;
}

/**
 * Builds the canonical shareable URL for a store/tenant.
 * Generates subdomain link if available, falling back to path-based link.
 */
export function getTenantStoreUrl(store, isLocalMode = false) {
  if (!store) return "";

  const identifier = store.subdomain || store.slug || store._id;
  if (!identifier) return "";

  if (typeof window === "undefined") {
    return `https://${identifier}.bharatshopy.com`;
  }

  const host = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : "";
  const protocol = window.location.protocol;

  // Local testing support:
  if (host === "localhost" || host.endsWith(".localhost") || isLocalMode) {
    return `${protocol}//${identifier}.localhost${port}`;
  }

  if (host.endsWith("lvh.me")) {
    return `${protocol}//${identifier}.lvh.me${port}`;
  }

  // If in production or custom domain:
  if (host.includes("bharatshopy.com")) {
    const baseDomain = host.split(".").slice(-2).join(".");
    return `https://${identifier}.${baseDomain}`;
  }

  // Universal path fallback
  return `${window.location.origin}/shop/${identifier}`;
}
