import React, { useEffect, useState } from "react";
import { api } from "../api";

function getQueryDay() {
  const m = location.hash.match(/day=([\d-]+)/);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

export default function DayCheckin() {
  const [day] = useState(getQueryDay());
  const [record, setRecord] = useState({
    screen_minutes: 0,
    homework_done: 0,
    reading_minutes: 0,
    exercise_minutes: 0,
  });
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api.getDay(day);
    setRecord(d.record || record);
    const u = await api.listUploads(day);
    setUploads(u.uploads || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api.saveDay(day, record);
      await load();
      alert("已保存");
    } finally {
      setBusy(false);
    }
  }

  async function doUpload(category, file) {
    const fd = new FormData();
    fd.append("category", category);
    fd.append("file", file);
    await api.upload(day, fd);
    await load();
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">每日打卡：{day}</div>

        <div className="row">
          <div className="col">
            <label>手机/电视使用时长（分钟，≤90 才合规）</label>
            <input
              className="input"
              type="number"
              value={record.screen_minutes}
              onChange={(e) =>
                setRecord({
                  ...record,
                  screen_minutes: Number(e.target.value || 0),
                })
              }
            />
            <div style={{ height: 8 }} />
            <label>作业完成</label>
            <input
              type="checkbox"
              checked={!!record.homework_done}
              onChange={(e) =>
                setRecord({
                  ...record,
                  homework_done: e.target.checked ? 1 : 0,
                })
              }
            />
            <div style={{ height: 8 }} />
            <label>阅读分钟数（≥30）</label>
            <input
              className="input"
              type="number"
              value={record.reading_minutes}
              onChange={(e) =>
                setRecord({
                  ...record,
                  reading_minutes: Number(e.target.value || 0),
                })
              }
            />
            <div style={{ height: 8 }} />
            <label>运动分钟数（≥25）</label>
            <input
              className="input"
              type="number"
              value={record.exercise_minutes}
              onChange={(e) =>
                setRecord({
                  ...record,
                  exercise_minutes: Number(e.target.value || 0),
                })
              }
            />
          </div>

          <div className="col">
            <div className="h1" style={{ fontSize: 14 }}>
              上传佐证材料
            </div>
            <div className="muted">可上传图片/视频；类别用于家长查看更清晰</div>

            <div style={{ height: 10 }} />
            {[
              ["homework", "作业照片"],
              ["reading", "阅读佐证"],
              ["exercise", "运动佐证"],
              ["screen", "屏幕使用截图"],
              ["other", "其他"],
            ].map(([cat, label]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <label>{label}</label>
                <input
                  className="input"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) doUpload(cat, f);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="row">
          <button className="btn" disabled={busy} onClick={save}>
            保存打卡
          </button>
          <a className="btn secondary" href="#/">
            返回
          </a>
        </div>

        <hr />
        <div className="h1" style={{ fontSize: 14 }}>
          已上传
        </div>
        {uploads.length === 0 && <div className="muted">暂无</div>}
        {uploads.map((u) => (
          <div
            key={u.id}
            className="card"
            style={{ boxShadow: "none", border: "1px solid #eee" }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="badge">{u.category}</div>
              <div className="muted">{u.created_at}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <a
                className="btn secondary"
                href={`http://localhost:3001${u.url}`}
                target="_blank"
              >
                打开文件
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
