import express from "express";
import router from "./routes/routes.index.js";
import cors from "cors";

const app = express();

const PORT = 7002;

// Middleware
app.use(cors());
app.use(express.json());

//Routes
app.use('/',router)

app.listen(PORT,()=>{console.log(`server started at ${PORT}`)})