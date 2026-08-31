import express from "express";
import router from "./routes/routes.index.js";
import cors from "cors";
import connectDB from "./db/connection.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
const app = express();

app.use(cors());
app.use(cors({ 
  origin: [
    'https://bharat-shoppy-client.vercel.app', 
    'https://bharatshopy.com'
  ] 
}));app.use(express.json());

dotenv.config();
await connectDB();
app.use("/api", router);

export default app;