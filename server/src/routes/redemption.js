import express from "express";
import { db } from "../db.js";
import { authRequired } from "../auth.js";

const router = express.Router();

router.post("/", authRequired, (req, res) => {
  const uid = req.user.uid;
  const minutes = Number(req.body?.minutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0)
    return res.status(400).json({ error: "Invalid minutes" });

  const bal = db
    .prepare(
      "SELECT COALESCE(SUM(delta_minutes),0) AS balance FROM game_ledger WHERE user_id=?"
    )
    .get(uid).balance;
  if (minutes > bal)
    return res
      .status(400)
      .json({ error: "Insufficient balance", balance: bal });

  db.prepare(
    "INSERT INTO game_ledger(user_id, day, delta_minutes, reason, note) VALUES(?,?,?,?,?)"
  ).run(
    uid,
    new Date().toISOString().slice(0, 10),
    -minutes,
    "redeem",
    req.body?.note || ""
  );

  res.json({ ok: true });
});

router.get("/history/me", authRequired, (req, res) => {
  const uid = req.user.uid;
  const rows = db
    .prepare(
      "SELECT * FROM game_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 200"
    )
    .all(uid);
  res.json({ items: rows });
});

export default router;
