// Vercel entry point for the API.
// The root vercel.json rewrites /api/* here. Express still sees the original
// path (for example /api/health), so the routes in server/src are unchanged.
import app from "../server/src/index.js";

export default app;
