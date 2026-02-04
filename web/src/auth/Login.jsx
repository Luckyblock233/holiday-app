import React, { useState } from "react";
import { api, setToken } from "../api";

export default function Login({ onLogin }) {
  const [username, setU] = useState("student");
  const [password, setP] = useState("");
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Holiday App
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            假期打卡系统
          </div>
          <div className="muted">学生端/家长端通用登录</div>
        </div>

        <div className="card">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label>用户名</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setU(e.target.value)}
              />
            </div>
            <div>
              <label>密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setP(e.target.value)}
              />
            </div>
            {err && <div className="badge danger">{err}</div>}
            <button className="btn w-full" type="submit">
              登录
            </button>
          </form>
          <hr />
          {/* <div className="muted">
            初次使用：后端调用 /api/auth/seed 创建默认账号（admin/admin123,
            student/student123）。
          </div> */}
        </div>
      </div>
    </div>
  );
}
