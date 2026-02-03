import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { signToken } from "../auth.js";

const router = express.Router();

// 一次性初始化：创建 admin/student（你可删掉，或加环境变量保护）
router.post("/seed", (req, res) => {
  const adminPwd = req.body.adminPwd || "admin123";
  const studentPwd = req.body.studentPwd || "student123";

  const ins = db.prepare(
    "INSERT OR IGNORE INTO users(username,password_hash,role,child_name) VALUES(?,?,?,?)"
  );

  ins.run("admin", bcrypt.hashSync(adminPwd, 10), "admin", null);
  ins.run("student", bcrypt.hashSync(studentPwd, 10), "student", "小朋友");

  res.json({ ok: true, admin: "admin", student: "student" });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user);
  res.json({
    token,
    role: user.role,
    username: user.username,
    childName: user.child_name,
  });
});

export default router;
