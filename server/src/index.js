import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./db/connection.js";

// Ensure database connection
await connectDB();

const PORT = process.env.PORT || 7002;

// Listen when started directly (non-serverless local environments)
if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
