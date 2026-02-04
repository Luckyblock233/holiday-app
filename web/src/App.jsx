import React, { useEffect, useState } from "react";
import Login from "./auth/Login.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import DayCheckin from "./pages/DayCheckin.jsx";
import Notes from "./pages/Notes.jsx";
import Redeem from "./pages/Redeem.jsx";
import { getToken, setToken } from "./api.js";

function getRoute() {
  const h = location.hash || "#/";
  if (h.startsWith("#/checkin")) return "checkin";
  if (h.startsWith("#/notes")) return "notes";
  if (h.startsWith("#/redeem")) return "redeem";
  return "home";
}

export default function App() {
  const [me, setMe] = useState(null);
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 极简：没 token 就必须登录（你也可以解码 token 恢复 role）
  useEffect(() => {
    if (!getToken()) setMe(null);
  }, []);

  if (!getToken() || !me) {
    return <Login onLogin={setMe} />;
  }

  const logout = () => {
    setToken("");
    setMe(null);
    location.hash = "#/";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              假期打卡系统
            </div>
            <div className="text-sm font-semibold text-slate-900">
              当前身份：{me.role}
            </div>
          </div>
          <button className="btn secondary" onClick={logout}>
            退出
          </button>
        </div>
      </div>

      {route === "checkin" && <DayCheckin />}
      {route === "notes" && <Notes />}
      {route === "redeem" &&
        (me.role === "admin" ? <Redeem /> : <StudentDashboard />)}
      {route === "home" &&
        (me.role === "admin" ? <AdminDashboard /> : <StudentDashboard />)}
    </div>
  );
}
