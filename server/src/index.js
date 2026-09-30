import dotenv from "dotenv";
dotenv.config();

import express from "express";
import router from "./routes/routes.index.js";
import cors from "cors";
import connectDB from "./db/connection.js";

const app = express();

const allowedOrigins = [
  "https://bharat-shoppy-client.vercel.app",
  "https://bharatshopy.com",
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

await connectDB();
app.use("/api", router);

export default app;