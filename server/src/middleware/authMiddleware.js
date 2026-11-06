import { verifyToken, signToken, getAuthSecret } from "../lib/tokenHelper.js";

/**
 * Middleware requiring valid admin authentication.
 * Verifies session token from httpOnly cookie or Authorization header.
 * Renews the 1-hour session while active.
 */
export function requireAdmin(req, res, next) {
  try {
    let token = req.cookies?.admin_session;

    if (!token && req.headers?.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: "Invalid or expired admin session" });
    }

    if (payload.role !== "admin") {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    // Session renewal: extend session cookie by 1 hour while active
    try {
      const renewedToken = signToken(
        { adminId: payload.adminId, email: payload.email, role: "admin" },
        getAuthSecret(),
        3600
      );
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("admin_session", renewedToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 3600 * 1000,
        path: "/",
      });
    } catch {
      // Cookie renewal failure should not block request
    }

    req.admin = payload;
    return next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ message: "Authentication check failed" });
  }
}
