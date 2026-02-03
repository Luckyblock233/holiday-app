import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function Redeem() {
  const [balance, setBalance] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);

  async function load() {
    const b = await api.myBalance();
    const h = await api.redeemHistory();
    setBalance(b.balance);
    setItems(h.items || []);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">兑现游戏时间</div>
        <div className="badge good">当前余额：{balance} 分钟</div>

        <div style={{ height: 12 }} />
        <label>兑现分钟数</label>
        <input
          className="input"
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value || 0))}
        />
        <div style={{ height: 8 }} />
        <label>备注（可选，例如“王者一局”）</label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div style={{ height: 10 }} />
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              try {
                await api.redeem(minutes, note);
                setNote("");
                await load();
                alert("已兑现");
              } catch (e) {
                alert(e.message);
              }
            }}
          >
            确认兑现
          </button>
          <a className="btn secondary" href="#/">
            返回
          </a>
        </div>

        <hr />
        <div className="h1" style={{ fontSize: 14 }}>
          流水（含获得/兑现）
        </div>
        {items.slice(0, 30).map((it) => (
          <div
            key={it.id}
            className="card"
            style={{ boxShadow: "none", border: "1px solid #eee" }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="badge">{it.reason}</div>
              <div className="badge">
                {it.delta_minutes > 0
                  ? `+${it.delta_minutes}`
                  : it.delta_minutes}{" "}
                分钟
              </div>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {it.created_at} · day={it.day}
            </div>
            {it.note && (
              <div className="muted" style={{ marginTop: 6 }}>
                {it.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
