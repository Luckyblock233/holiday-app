import express from "express";
import { db } from "../db.js";
import { authRequired, requireRole } from "../auth.js";
import { calcEarnedMinutes, isScreenViolated } from "../rules.js";

const router = express.Router();

router.get("/days/:day", authRequired, requireRole("admin"), (req, res) => {
  const { day } = req.params;
  const student = db
    .prepare(
      "SELECT id, username, child_name FROM users WHERE role='student' LIMIT 1"
    )
    .get();
  if (!student) return res.json({ items: [] });

  const record = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(student.id, day);
  const notesCount = db
    .prepare(
      "SELECT COUNT(*) AS c FROM reading_notes WHERE user_id=? AND day=?"
    )
    .get(student.id, day).c;

  const y = new Date(day);
  y.setDate(y.getDate() - 1);
  const yday = y.toISOString().slice(0, 10);
  const yRecord = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(student.id, yday);
  const yViolated = isScreenViolated(yRecord);

  const calc = calcEarnedMinutes({
    todayRecord: record,
    todayNotesCount: notesCount,
    isParentChecked: record ? !!record.parent_checked : false,
    yesterdayScreenViolated: yViolated,
  });

  res.json({
    student,
    record,
    notesCount,
    calc,
    yesterdayScreenViolated: yViolated,
  });
});

router.post(
  "/days/:day/check",
  authRequired,
  requireRole("admin"),
  (req, res) => {
    const { day } = req.params;
    const student = db
      .prepare("SELECT id FROM users WHERE role='student' LIMIT 1")
      .get();
    if (!student) return res.status(400).json({ error: "No student" });

    const checked = req.body?.checked ? 1 : 0;
    db.prepare(
      `
    INSERT INTO day_records(user_id, day, parent_checked)
    VALUES(?,?,?)
    ON CONFLICT(user_id, day) DO UPDATE SET parent_checked=excluded.parent_checked
  `
    ).run(student.id, day, checked);

    res.json({ ok: true });
  }
);

export default router;
