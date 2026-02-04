import express from "express";
import { db } from "../db.js";
import { authRequired, requireRole } from "../auth.js";
import { calcEarnedMinutes, isScreenViolated } from "../rules.js";
import { getChinaDateISO, shiftDayISO } from "../time.js";

const router = express.Router();

function getStudent() {
  return db
    .prepare(
      "SELECT id, username, child_name FROM users WHERE role='student' LIMIT 1"
    )
    .get();
}

router.get("/days/:day", authRequired, requireRole("admin"), (req, res) => {
  const { day } = req.params;
  const student = getStudent();
  if (!student) return res.json({ items: [] });

  const record = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(student.id, day);
  const notesCount = db
    .prepare(
      "SELECT COUNT(*) AS c FROM reading_notes WHERE user_id=? AND day=?"
    )
    .get(student.id, day).c;

  const yday = shiftDayISO(day, -1);
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

router.get("/uploads/:day", authRequired, requireRole("admin"), (req, res) => {
  const { day } = req.params;
  const student = getStudent();
  if (!student) return res.status(400).json({ error: "No student" });

  const uploadRows = db
    .prepare(
      "SELECT * FROM uploads WHERE user_id=? AND day=? ORDER BY created_at DESC"
    )
    .all(student.id, day);

  const noteRows = db
    .prepare(
      "SELECT * FROM reading_notes WHERE user_id=? AND day=? ORDER BY created_at DESC"
    )
    .all(student.id, day);

  const combined = [];
  for (const r of uploadRows) {
    combined.push({
      id: r.id,
      category: r.category,
      filename: r.filename,
      mime: r.mime || "",
      created_at: r.created_at,
      url: `/api/uploads/file/${r.filename}`,
    });
  }

  for (const n of noteRows) {
    let payload = null;
    try {
      payload = JSON.parse(n.content);
    } catch {
      payload = null;
    }
    if (payload?.type === "image" && payload.filename) {
      combined.push({
        id: `note_${n.id}`,
        category: "notes",
        filename: payload.filename,
        mime: payload.mime || "",
        created_at: n.created_at,
        url: `/api/uploads/file/${payload.filename}`,
      });
    }
  }

  combined.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const page = Math.max(1, Number(req.query?.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query?.pageSize || 9)));
  const total = combined.length;
  const offset = (page - 1) * pageSize;
  const pageItems = combined.slice(offset, offset + pageSize);

  const categories = {};
  for (const item of pageItems) {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  }

  res.json({ categories, total, page, pageSize });
});

router.post("/ledger/adjust", authRequired, requireRole("admin"), (req, res) => {
  const student = getStudent();
  if (!student) return res.status(400).json({ error: "No student" });

  const minutes = Number(req.body?.minutes || 0);
  if (!Number.isFinite(minutes) || minutes === 0) {
    return res.status(400).json({ error: "Invalid minutes" });
  }

  const day = req.body?.day || getChinaDateISO();
  const note = req.body?.note || "";

  db.prepare(
    "INSERT INTO game_ledger(user_id, day, delta_minutes, reason, note) VALUES(?,?,?,?,?)"
  ).run(student.id, day, minutes, "adjust", note);

  res.json({ ok: true });
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
