import React, { useEffect, useState } from "react";
import { api, API_BASE } from "../api";
import { formatChinaDateTime, getLocalDateISO } from "../date";

function getQueryDay() {
  const m = location.hash.match(/day=([\d-]+)/);
  return m ? m[1] : getLocalDateISO();
}

export default function Notes() {
  const [day] = useState(getQueryDay());
  const [notes, setNotes] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  async function load() {
    const d = await api.getDay(day);
    setNotes(d.notes || []);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container py-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h1">读书笔记：{day}</div>
            <div className="muted">仅支持上传图片（例如拍照的读书笔记）</div>
          </div>
          <a className="btn secondary" href="#/">
            返回
          </a>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            key={inputKey}
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            className="btn"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              setBusy(true);
              try {
                await api.addNote(day, fd);
                setFile(null);
                setInputKey((k) => k + 1);
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            上传笔记图片
          </button>
        </div>

        <hr />
        {notes.length === 0 && (
          <div className="muted">今天还没有笔记（至少 1 条才算阅读达标）</div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => {
            const isImage = n.kind === "image" && n.url;
            const fileUrl = isImage ? `${API_BASE}${n.url}` : null;
            return (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-soft"
              >
                <div className="muted">
                  {formatChinaDateTime(n.created_at)}
                </div>
                {isImage ? (
                  <>
                    <div className="mt-2">
                      <img className="thumb" src={fileUrl} alt="读书笔记" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <a
                        className="btn secondary w-full justify-center"
                        href={fileUrl}
                        target="_blank"
                      >
                        打开大图
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {n.content}
                  </div>
                )}
                <div className="mt-2">
                  <button
                    className="btn secondary w-full justify-center"
                    onClick={async () => {
                      await api.delNote(n.id);
                      await load();
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
