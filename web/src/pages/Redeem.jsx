import React, { useEffect, useState } from "react";
import { api } from "../api";
import { formatChinaDateTime } from "../date";

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
    <div className="container py-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h1">兑现游戏时间</div>
            <div className="muted">把积累的奖励兑换成当天的游戏时长</div>
          </div>
          <a className="btn secondary" href="#/">
            返回
          </a>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50 p-3">
          <div className="muted">当前余额</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {balance} 分钟
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label>兑现分钟数</label>
            <input
              className="input"
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <label>备注（可选，例如“王者一局”）</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            className="btn w-full sm:w-auto"
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
        </div>

        <hr />
        <div className="text-sm font-semibold text-slate-900">
          流水（含获得/兑现）
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.slice(0, 30).map((it) => (
            <div
              key={it.id}
              className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="badge">{it.reason}</div>
                <div className="badge">
                  {it.delta_minutes > 0
                    ? `+${it.delta_minutes}`
                    : it.delta_minutes}{" "}
                  分钟
                </div>
              </div>
              <div className="muted mt-2">
                {formatChinaDateTime(it.created_at)} · day={it.day}
              </div>
              {it.note && <div className="muted mt-2">{it.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
