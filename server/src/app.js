import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import router from "./routes/routes.index.js";
import { assertSigningSecret } from "./lib/tokenHelper.js";
import { writeRateLimiter } from "./middleware/rateLimitMiddleware.js";

// Ensure signing secret exists in runtime environment
assertSigningSecret();

const app = express();

// Trust reverse proxy (Vercel, Nginx, Cloudflare)
app.set("trust proxy", 1);

// Security headers with helmet
app.use(helmet());

/**
 * Validates whether an incoming HTTP Origin header is allowed by CORS policy.
 * Only allows CLIENT_URL, https://bharatshopy.com (and its subdomains),
 * plus localhost and lvh.me in non-production environments.
 */
export function isOriginAllowed(origin) {
  if (!origin) return true; // Direct/same-origin or server-to-server

  // Configured client URL from environment
  if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
    return true;
  }

  // Official production domain and its wildcard subdomains (https only)
  if (/^https:\/\/([a-z0-9-]+\.)*bharatshopy\.com$/i.test(origin)) {
    return true;
  }

  // Development & local staging origins (disabled in production)
  if (process.env.NODE_ENV !== "production") {
    if (/^https?:\/\/([a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin)) {
      return true;
    }
    if (/^https?:\/\/([a-z0-9-]+\.)*lvh\.me(:\d+)?$/i.test(origin)) {
      return true;
    }
  }

  return false;
}

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Health check endpoint
app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection?.readyState === 1;
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: isDbConnected ? "connected" : "disconnected",
    uptime: Math.floor(process.uptime()),
  });
});

// Mutating API operations rate limiting (POST, PUT, DELETE, PATCH)
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    return writeRateLimiter(req, res, next);
  }
  return next();
});

// Application routes
app.use("/api", router);

export default app;
