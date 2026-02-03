import express from "express";
import { db } from "../db.js";
import { authRequired } from "../auth.js";
import { calcEarnedMinutes, isScreenViolated } from "../rules.js";

const router = express.Router();

router.get("/:day", authRequired, (req, res) => {
  const { day } = req.params;
  const uid = req.user.uid;

  const record = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(uid, day);
  const notes = db
    .prepare(
      "SELECT * FROM reading_notes WHERE user_id=? AND day=? ORDER BY created_at DESC"
    )
    .all(uid, day);
  const notesCount = notes.length;

  // 昨天是否违规：用于次日基础-10
  const y = new Date(day);
  y.setDate(y.getDate() - 1);
  const yday = y.toISOString().slice(0, 10);
  const yRecord = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(uid, yday);
  const yViolated = isScreenViolated(yRecord);

  const isParentChecked = record ? !!record.parent_checked : false;
  const calc = calcEarnedMinutes({
    todayRecord: record,
    todayNotesCount: notesCount,
    isParentChecked,
    yesterdayScreenViolated: yViolated,
  });

  res.json({ record, notes, calc, yesterdayScreenViolated: yViolated });
});

router.put("/:day", authRequired, (req, res) => {
  const { day } = req.params;
  const uid = req.user.uid;

  const {
    screen_minutes = 0,
    homework_done = 0,
    reading_minutes = 0,
    exercise_minutes = 0,
  } = req.body || {};

  db.prepare(
    `
    INSERT INTO day_records(user_id, day, screen_minutes, homework_done, reading_minutes, exercise_minutes)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(user_id, day) DO UPDATE SET
      screen_minutes=excluded.screen_minutes,
      homework_done=excluded.homework_done,
      reading_minutes=excluded.reading_minutes,
      exercise_minutes=excluded.exercise_minutes
  `
  ).run(
    uid,
    day,
    screen_minutes,
    homework_done ? 1 : 0,
    reading_minutes,
    exercise_minutes
  );

  res.json({ ok: true });
});

router.post("/:day/notes", authRequired, (req, res) => {
  const { day } = req.params;
  const uid = req.user.uid;
  const { content } = req.body || {};
  if (!content || content.trim().length < 3)
    return res.status(400).json({ error: "Content too short" });

  db.prepare(
    "INSERT INTO reading_notes(user_id, day, content) VALUES(?,?,?)"
  ).run(uid, day, content.trim());
  res.json({ ok: true });
});

router.delete("/notes/:id", authRequired, (req, res) => {
  const uid = req.user.uid;
  const id = Number(req.params.id);
  db.prepare("DELETE FROM reading_notes WHERE id=? AND user_id=?").run(id, uid);
  res.json({ ok: true });
});

// 结算：把当天 earned 记入 ledger（避免重复结算：同一天已 earned 就不再插入）
router.post("/:day/settle", authRequired, (req, res) => {
  const { day } = req.params;
  const uid = req.user.uid;

  const already = db
    .prepare(
      "SELECT 1 FROM game_ledger WHERE user_id=? AND day=? AND reason='earned'"
    )
    .get(uid, day);
  if (already) return res.status(400).json({ error: "Already settled" });

  const record = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(uid, day);
  const notesCount = db
    .prepare(
      "SELECT COUNT(*) AS c FROM reading_notes WHERE user_id=? AND day=?"
    )
    .get(uid, day).c;

  const y = new Date(day);
  y.setDate(y.getDate() - 1);
  const yday = y.toISOString().slice(0, 10);
  const yRecord = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(uid, yday);
  const yViolated = isScreenViolated(yRecord);

  const isParentChecked = record ? !!record.parent_checked : false;
  const calc = calcEarnedMinutes({
    todayRecord: record,
    todayNotesCount: notesCount,
    isParentChecked,
    yesterdayScreenViolated: yViolated,
  });

  db.prepare(
    "INSERT INTO game_ledger(user_id, day, delta_minutes, reason, note) VALUES(?,?,?,?,?)"
  ).run(uid, day, calc.earned, "earned", JSON.stringify(calc.breakdown));

  res.json({ ok: true, earned: calc.earned, breakdown: calc.breakdown });
});

// 余额查询
router.get("/balance/me", authRequired, (req, res) => {
  const uid = req.user.uid;
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(delta_minutes),0) AS balance FROM game_ledger WHERE user_id=?"
    )
    .get(uid);
  res.json({ balance: row.balance });
});

export default router;
