import express from "express";
import { db } from "../db.js";
import { authRequired, requireRole } from "../auth.js";
import { getChinaDateISO } from "../time.js";

const router = express.Router();

function getStudentId() {
  const row = db
    .prepare("SELECT id FROM users WHERE role='student' LIMIT 1")
    .get();
  return row?.id || null;
}

router.post("/", authRequired, requireRole("admin"), (req, res) => {
  const uid = getStudentId();
  if (!uid) return res.status(400).json({ error: "No student" });
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
    getChinaDateISO(),
    -minutes,
    "redeem",
    req.body?.note || ""
  );

  res.json({ ok: true });
});

router.get("/history/me", authRequired, requireRole("admin"), (req, res) => {
  const uid = getStudentId();
  if (!uid) return res.status(400).json({ error: "No student" });
  const rows = db
    .prepare(
      "SELECT * FROM game_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 200"
    )
    .all(uid);
  res.json({ items: rows });
});

export default router;
