import express from "express";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "../db.js";
import { authRequired, requireRole } from "../auth.js";
import { calcEarnedMinutes, isScreenViolated } from "../rules.js";
import { shiftDayISO } from "../time.js";

const router = express.Router();

function getStudentId() {
  const row = db
    .prepare("SELECT id FROM users WHERE role='student' LIMIT 1")
    .get();
  return row?.id || null;
}

const UPLOAD_DIR = "./uploads";
const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE || 10 * 1024 * 1024);
const MAX_IMAGE_PIXELS = Number(process.env.MAX_IMAGE_PIXELS || 50_000_000);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

function extFromMime(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return "";
}

const noteStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = extFromMime(file.mimetype);
    const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});
const noteUpload = multer({
  storage: noteStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
    }
    return cb(null, true);
  },
});

async function compressImage(filePath, mime) {
  if (!mime || !mime.startsWith("image/")) return;

  const transformer = sharp(filePath, {
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .resize({
    width: 1600,
    withoutEnlargement: true,
  });

  if (mime === "image/png") {
    await transformer.png({ compressionLevel: 9 }).toFile(`${filePath}.tmp`);
  } else if (mime === "image/webp") {
    await transformer.webp({ quality: 80 }).toFile(`${filePath}.tmp`);
  } else {
    await transformer.jpeg({ quality: 80, mozjpeg: true }).toFile(`${filePath}.tmp`);
  }

  fs.renameSync(`${filePath}.tmp`, filePath);
}

router.get("/:day", authRequired, (req, res) => {
  const { day } = req.params;
  const uid = req.user.uid;

  const record = db
    .prepare("SELECT * FROM day_records WHERE user_id=? AND day=?")
    .get(uid, day);
  const rawNotes = db
    .prepare(
      "SELECT * FROM reading_notes WHERE user_id=? AND day=? ORDER BY created_at DESC"
    )
    .all(uid, day);
  const notesCount = rawNotes.length;
  const notes = rawNotes.map((n) => {
    let payload = null;
    try {
      payload = JSON.parse(n.content);
    } catch {
      payload = null;
    }
    if (payload?.type === "image" && payload.filename) {
      return {
        ...n,
        kind: "image",
        url: `/api/uploads/file/${payload.filename}`,
        mime: payload.mime || "",
      };
    }
    return { ...n, kind: "text" };
  });

  // 昨天是否违规：用于次日基础-10
  const yday = shiftDayISO(day, -1);
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

router.post("/:day/notes", authRequired, noteUpload.single("file"), async (req, res) => {
  const { day } = req.params;
  const uid = req.user.uid;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file" });

  try {
    await compressImage(file.path, file.mimetype);
  } catch (e) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore
    }
    return res.status(400).json({ error: "Invalid image" });
  }

  const payload = JSON.stringify({
    type: "image",
    filename: file.filename,
    mime: file.mimetype,
    originalName: file.originalname,
  });

  db.prepare(
    "INSERT INTO reading_notes(user_id, day, content) VALUES(?,?,?)"
  ).run(uid, day, payload);
  res.json({ ok: true });
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large" });
    }
    return res.status(400).json({ error: "Only jpeg/png/webp allowed" });
  }
  return next(err);
});

router.delete("/notes/:id", authRequired, (req, res) => {
  const uid = req.user.uid;
  const id = Number(req.params.id);
  db.prepare("DELETE FROM reading_notes WHERE id=? AND user_id=?").run(id, uid);
  res.json({ ok: true });
});

// 结算：把当天 earned 记入 ledger（避免重复结算：同一天已 earned 就不再插入）
router.post("/:day/settle", authRequired, requireRole("admin"), (req, res) => {
  const { day } = req.params;
  const uid = getStudentId();
  if (!uid) return res.status(400).json({ error: "No student" });

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

  const yday = shiftDayISO(day, -1);
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
  const uid =
    req.user.role === "admin" ? getStudentId() : req.user.uid;
  if (!uid) return res.status(400).json({ error: "No student" });
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(delta_minutes),0) AS balance FROM game_ledger WHERE user_id=?"
    )
    .get(uid);
  res.json({ balance: row.balance });
});

export default router;
