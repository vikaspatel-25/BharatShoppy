import crypto from "node:crypto";

/**
 * Validates that an authentication signing secret is present in the environment.
 * Refuses execution if none is found.
 */
export function assertSigningSecret(env = process.env) {
  const secret = env.AUTH_SECRET || env.SESSION_SECRET || env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Missing required signing secret: AUTH_SECRET (or SESSION_SECRET). Server refusing to start."
    );
  }
  return secret;
}

/**
 * Get active signing secret from environment.
 */
export function getAuthSecret(env = process.env) {
  return assertSigningSecret(env);
}

/**
 * Hash a plain text string using SHA-256 (used for verification codes).
 */
export function hashString(value) {
  if (typeof value !== "string") {
    value = String(value);
  }
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Encodes an object to URL-safe Base64 string.
 */
function base64UrlEncode(obj) {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(json).toString("base64url");
}

/**
 * Decodes a URL-safe Base64 string to an object.
 */
function base64UrlDecode(str) {
  const json = Buffer.from(str, "base64url").toString("utf8");
  return JSON.parse(json);
}

/**
 * Signs a payload with HMAC-SHA256 and returns a compact token.
 */
export function signToken(payload, secret = getAuthSecret(), expiresInSeconds = 3600) {
  if (!secret) {
    throw new Error("Signing secret is required to sign token");
  }
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(fullPayload);

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a token's HMAC-SHA256 signature and expiration.
 */
export function verifyToken(token, secret = getAuthSecret()) {
  if (!token || typeof token !== "string") {
    throw new Error("Token missing or invalid");
  }
  if (!secret) {
    throw new Error("Signing secret is required to verify token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed token structure");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid token signature");
  }

  const payload = base64UrlDecode(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
}
