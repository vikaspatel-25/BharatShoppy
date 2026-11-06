import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./db/connection.js";

await connectDB();

const PORT = process.env.PORT || 7002;
app.listen(PORT, () => {
  console.log(`[Dev] Server running on port ${PORT}`);
});

export default app;
