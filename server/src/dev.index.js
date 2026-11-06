import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import { assertSigningSecret } from "./lib/tokenHelper.js";

assertSigningSecret();
import router from "./routes/routes.index.js";
import cors from "cors";
import connectDB from "./db/connection.js";

const app = express();

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  // Allow localhost & lvh.me with any subdomain or port
  if (/^https?:\/\/([a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/([a-z0-9-]+\.)*lvh\.me(:\d+)?$/i.test(origin)) return true;
  // Allow bharatshopee and bharatshoppy with any subdomain
  if (/^https?:\/\/([a-z0-9-]+\.)*bharatshope?e?y?\.com(:\d+)?$/i.test(origin)) return true;
  // Allow Vercel preview/production deployments
  if (/\.vercel\.app$/i.test(origin)) return true;

  return true;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

await connectDB();
app.use("/api", router);

const PORT = process.env.PORT || 7002;
app.listen(PORT, () => {
  console.log(`server started at port ${PORT}`);
});
