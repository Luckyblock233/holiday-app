import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "../db.js";
import { authRequired } from "../auth.js";

const router = express.Router();

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = extFromMime(file.mimetype);
    const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
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

router.post("/:day", authRequired, upload.single("file"), async (req, res) => {
  const uid = req.user.uid;
  const { day } = req.params;
  const { category = "other" } = req.body || {};
  if (!req.file) return res.status(400).json({ error: "No file" });

  try {
    await compressImage(req.file.path, req.file.mimetype);
  } catch (e) {
    try {
      fs.unlinkSync(req.file.path);
    } catch {
      // ignore
    }
    return res.status(400).json({ error: "Invalid image" });
  }

  const finalSize = fs.existsSync(req.file.path)
    ? fs.statSync(req.file.path).size
    : req.file.size;

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
    finalSize
  );

  res.json({ ok: true, fileUrl: `/api/uploads/file/${req.file.filename}` });
});

router.get("/file/:filename", authRequired, (req, res) => {
  const { filename } = req.params;
  if (!filename || filename !== path.basename(filename)) {
    return res.status(404).end();
  }

  let mime = null;
  const uploadRow = db
    .prepare("SELECT user_id, mime FROM uploads WHERE filename=?")
    .get(filename);
  if (uploadRow) {
    if (req.user.role !== "admin" && uploadRow.user_id !== req.user.uid) {
      return res.status(404).end();
    }
    mime = uploadRow.mime || null;
  } else {
    const noteRows =
      req.user.role === "admin"
        ? db.prepare("SELECT content FROM reading_notes").all()
        : db
            .prepare("SELECT content FROM reading_notes WHERE user_id=?")
            .all(req.user.uid);
    for (const r of noteRows) {
      try {
        const payload = JSON.parse(r.content);
        if (payload?.type === "image" && payload.filename === filename) {
          mime = payload.mime || null;
          break;
        }
      } catch {
        // ignore invalid rows
      }
    }
    if (!mime) return res.status(404).end();
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  if (mime) res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, max-age=0, no-store");
  res.sendFile(path.resolve(filePath));
});

router.get("/:day", authRequired, (req, res) => {
  const uid = req.user.uid;
  const { day } = req.params;
  const page = Math.max(1, Number(req.query?.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query?.pageSize || 8)));
  const total = db
    .prepare("SELECT COUNT(*) AS c FROM uploads WHERE user_id=? AND day=?")
    .get(uid, day).c;
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      "SELECT * FROM uploads WHERE user_id=? AND day=? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    .all(uid, day, pageSize, offset);
  res.json({
    uploads: rows.map((r) => ({
      ...r,
      url: `/api/uploads/file/${r.filename}`,
    })),
    total,
    page,
    pageSize,
  });
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

export default router;
