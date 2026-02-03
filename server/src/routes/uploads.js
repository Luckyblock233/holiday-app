import express from "express";
import multer from "multer";
import fs from "fs";
import { db } from "../db.js";
import { authRequired } from "../auth.js";

const router = express.Router();

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

router.post("/:day", authRequired, upload.single("file"), (req, res) => {
  const uid = req.user.uid;
  const { day } = req.params;
  const { category = "other" } = req.body || {};
  if (!req.file) return res.status(400).json({ error: "No file" });

  db.prepare(
    `
    INSERT INTO uploads(user_id, day, category, filename, mime, size)
    VALUES(?,?,?,?,?,?)
  `
  ).run(
    uid,
    day,
    category,
    req.file.filename,
    req.file.mimetype,
    req.file.size
  );

  res.json({ ok: true, fileUrl: `/uploads/${req.file.filename}` });
});

router.get("/:day", authRequired, (req, res) => {
  const uid = req.user.uid;
  const { day } = req.params;
  const rows = db
    .prepare(
      "SELECT * FROM uploads WHERE user_id=? AND day=? ORDER BY created_at DESC"
    )
    .all(uid, day);
  res.json({
    uploads: rows.map((r) => ({ ...r, url: `/uploads/${r.filename}` })),
  });
});

export default router;
