import React, { useState } from "react";
import { api, setToken } from "../api";

export default function Login({ onLogin }) {
  const [username, setU] = useState("student");
  const [password, setP] = useState("student123");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await api.login(username, password);
      setToken(data.token);
      onLogin({
        role: data.role,
        username: data.username,
        childName: data.childName,
      });
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">假期打卡系统</div>
        <div className="muted">学生端/家长端通用登录</div>
        <form onSubmit={submit} style={{ marginTop: 12 }}>
          <label>用户名</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setU(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <label>密码</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setP(e.target.value)}
          />
          {err && (
            <div style={{ marginTop: 10 }} className="badge danger">
              {err}
            </div>
          )}
          <div style={{ height: 10 }} />
          <button className="btn" type="submit">
            登录
          </button>
        </form>
        <hr />
        <div className="muted">
          初次使用：后端调用 /api/auth/seed 创建默认账号（admin/admin123,
          student/student123）。
        </div>
      </div>
    </div>
  );
}
