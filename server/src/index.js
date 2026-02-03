import express from "express";
import cors from "cors";
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

app.use("/uploads", express.static("./uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/days", dayRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/redeem", redeemRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log("Server on", port));
