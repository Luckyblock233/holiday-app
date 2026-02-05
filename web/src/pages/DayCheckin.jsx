import React, { useEffect, useState } from "react";
import { api, openSecureFile } from "../api";
import SecureImage from "../components/SecureImage.jsx";
import { formatChinaDateTime, getLocalDateISO } from "../date";

function getQueryDay() {
  const m = location.hash.match(/day=([\d-]+)/);
  return m ? m[1] : getLocalDateISO();
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
  const [uploadsPage, setUploadsPage] = useState(1);
  const [uploadsTotal, setUploadsTotal] = useState(0);
  const uploadsPageSize = 8;
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api.getDay(day);
    setRecord(d.record || record);
    const u = await api.listUploads(day, {
      page: uploadsPage,
      pageSize: uploadsPageSize,
    });
    setUploads(u.uploads || []);
    setUploadsTotal(u.total || 0);
  }

  useEffect(() => {
    load();
  }, [day, uploadsPage]);

  useEffect(() => {
    setUploadsPage(1);
  }, [day]);

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
    setUploadsPage(1);
    await load();
  }

  function isImageUpload(upload) {
    if (upload?.mime && upload.mime.startsWith("image/")) return true;
    if (!upload?.url) return false;
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(upload.url);
  }

  return (
    <div className="container py-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h1">每日打卡：{day}</div>
            <div className="muted">请如实填写，便于准确计算奖励</div>
          </div>
          <div className="flex gap-2">
            <button className="btn" disabled={busy} onClick={save}>
              保存打卡
            </button>
            <a className="btn secondary" href="#/">
              返回
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
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
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
              <div className="text-sm text-slate-700">作业完成</div>
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
            </div>
            <div>
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
            </div>
            <div>
              <label>运动分钟数（≥20）</label>
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
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">
              上传佐证材料
            </div>
            <div className="muted">可上传图片；类别用于家长查看更清晰</div>

            <div className="mt-3 space-y-3">
              {[
                ["exercise", "运动佐证"],
                ["screen", "屏幕使用截图"],
                ["other", "其他"],
              ].map(([cat, label]) => (
                <div key={cat}>
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
        </div>

        <hr />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">已上传</div>
          <div className="text-sm text-slate-600">
            第 {uploadsPage} / {Math.max(1, Math.ceil(uploadsTotal / uploadsPageSize))} 页
          </div>
        </div>
        {uploads.length === 0 && <div className="muted">暂无</div>}
        {uploads.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-soft"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="badge">{u.category}</div>
              <div className="muted">
                {formatChinaDateTime(u.created_at)}
              </div>
            </div>
            <div className="mt-2">
              {isImageUpload(u) && (
                <>
                  <SecureImage className="thumb" src={u.url} alt={u.category} />
                  <div className="h-2" />
                </>
              )}
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await openSecureFile(u.url);
                  } catch (e) {
                    alert(e.message);
                  }
                }}
              >
                打开文件
              </button>
            </div>
          </div>
        ))}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn secondary"
            disabled={uploadsPage <= 1}
            onClick={() => setUploadsPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <button
            className="btn secondary"
            disabled={uploadsPage >= Math.ceil(uploadsTotal / uploadsPageSize)}
            onClick={() =>
              setUploadsPage((p) =>
                Math.min(Math.max(1, Math.ceil(uploadsTotal / uploadsPageSize)), p + 1)
              )
            }
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
