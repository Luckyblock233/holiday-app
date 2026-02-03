import React, { useEffect, useState } from "react";
import { api } from "../api";

function getQueryDay() {
  const m = location.hash.match(/day=([\d-]+)/);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

export default function Notes() {
  const [day] = useState(getQueryDay());
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");

  async function load() {
    const d = await api.getDay(day);
    setNotes(d.notes || []);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">读书笔记：{day}</div>
        <div className="muted">
          建议格式：书名 + 今天读了什么 + 学到了什么（尽量具体）
        </div>
        <div style={{ height: 10 }} />
        <textarea
          className="input"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ height: 10 }} />
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              if (text.trim().length < 3) return alert("写得再多一点点～");
              await api.addNote(day, text.trim());
              setText("");
              await load();
            }}
          >
            添加笔记
          </button>
          <a className="btn secondary" href="#/">
            返回
          </a>
        </div>

        <hr />
        {notes.length === 0 && (
          <div className="muted">今天还没有笔记（至少 1 条才算阅读达标）</div>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="card"
            style={{ boxShadow: "none", border: "1px solid #eee" }}
          >
            <div className="muted">{n.created_at}</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
              {n.content}
            </div>
            <div style={{ height: 8 }} />
            <button
              className="btn secondary"
              onClick={async () => {
                await api.delNote(n.id);
                await load();
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
