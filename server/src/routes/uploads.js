import express from "express";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
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

async function compressImage(filePath, mime) {
  if (!mime || !mime.startsWith("image/")) return;
  if (mime === "image/gif") return;

  const transformer = sharp(filePath).resize({
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
    console.error("compressImage failed:", e);
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

  res.json({ ok: true, fileUrl: `/uploads/${req.file.filename}` });
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
    uploads: rows.map((r) => ({ ...r, url: `/uploads/${r.filename}` })),
    total,
    page,
    pageSize,
  });
});

export default router;
