import express from "express";
import router from "./routes/routes.index.js";
import cors from "cors";

const app = express();

app.use(cors());
app.use(cors({ 
  origin: [
    'https://bharat-shoppy-client.vercel.app', 
    'https://bharatshoppy.com'
  ] 
}));app.use(express.json());

app.use("/api", router);

export default app;