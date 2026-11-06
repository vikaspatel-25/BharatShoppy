/**
 * Extracts a tenant subdomain from a host/domain string.
 * Supports:
 * - Production: tenant.bharatshopy.com -> "tenant"
 * - Staging/Vercel: tenant.bharat-shoppy-client.vercel.app -> "tenant"
 * - Local dev: tenant.localhost -> "tenant"
 * - Local dev wildcard: tenant.lvh.me -> "tenant"
 * 
 * Ignored as root/reserved:
 * - "www", "app", "api", "admin", "mail", "cdn", "staging"
 * - Direct IP addresses and bare localhost
 */

export const RESERVED_SUBDOMAINS = new Set([
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

export function isReservedSubdomain(subdomain) {
  if (!subdomain) return false;
  return RESERVED_SUBDOMAINS.has(String(subdomain).trim().toLowerCase());
}

export function extractSubdomain(host) {
  if (!host || typeof host !== "string") {
    return null;
  }

  // Strip port if present (e.g. "tenant.localhost:5173" -> "tenant.localhost")
  const hostname = host.trim().split(":")[0].toLowerCase();

  // Guard against bare IPs (e.g., 127.0.0.1 or 192.168.1.1)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return null;
  }

  const reserved = RESERVED_SUBDOMAINS;

  // Handle localhost subdomains: e.g. "tenant.localhost"
  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    if (parts.length >= 2 && !reserved.has(parts[0])) {
      return parts[0];
    }
    return null;
  }

  // Handle lvh.me (points to 127.0.0.1 natively): e.g. "tenant.lvh.me"
  if (hostname.endsWith(".lvh.me")) {
    const parts = hostname.split(".");
    if (parts.length >= 3 && !reserved.has(parts[0])) {
      return parts[0];
    }
    return null;
  }

  const parts = hostname.split(".");
  // Normal domains need at least 3 parts for a subdomain: tenant.domain.tld
  if (parts.length < 3) {
    return null;
  }

  const candidate = parts[0];
  if (reserved.has(candidate)) {
    return null;
  }

  return candidate;
}
