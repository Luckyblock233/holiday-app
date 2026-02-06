import express from "express";
import { db } from "../db.js";
import { authRequired } from "../auth.js";

const router = express.Router();

function normalizeImages(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // ignore
  }
  return [];
}

router.get("/", authRequired, (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, title, description, link_url, link_label, images_json, sort_order FROM game_library ORDER BY sort_order ASC, id DESC"
    )
    .all();

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || "",
    linkUrl: r.link_url || "",
    linkLabel: r.link_label || "",
    images: normalizeImages(r.images_json),
    sortOrder: r.sort_order || 0,
  }));

  res.json({ items });
});

export default router;
