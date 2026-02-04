import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./db.js";

import authRoutes from "./routes/auth.js";
import dayRoutes from "./routes/days.js";
import uploadRoutes from "./routes/uploads.js";
import redeemRoutes from "./routes/redemption.js";
import adminRoutes from "./routes/admin.js";

initDb();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/api/days", dayRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/redeem", redeemRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const port = process.env.PORT || 3001;
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => console.log("Server on", host, port));
