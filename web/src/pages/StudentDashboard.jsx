import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentDashboard() {
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState(null);
  const [balance, setBalance] = useState(0);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const d = await api.getDay(day);
      const b = await api.myBalance();
      setData(d);
      setBalance(b.balance);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [day]);

  const breakdown = data?.calc?.breakdown || {};
  const earned = data?.calc?.earned ?? 0;

  const statusPills = useMemo(() => {
    const r = data?.record;
    if (!r) return [];
    const notesCount = data?.notes?.length || 0;
    return [
      { label: `屏幕 ${r.screen_minutes} 分钟`, ok: r.screen_minutes <= 90 },
      {
        label: `作业 ${r.homework_done ? "完成" : "未完成"}`,
        ok: !!r.homework_done,
      },
      { label: `阅读 ${r.reading_minutes} 分钟`, ok: r.reading_minutes >= 30 },
      { label: `笔记 ${notesCount} 条`, ok: notesCount >= 1 },
      {
        label: `运动 ${r.exercise_minutes} 分钟`,
        ok: r.exercise_minutes >= 25,
      },
    ];
  }, [data]);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">学生端</div>
        <div className="row">
          <div className="col">
            <label>选择日期</label>
            <input
              className="input"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            {data?.yesterdayScreenViolated && (
              <div style={{ marginTop: 8 }} className="badge warn">
                昨天屏幕超时：今天基础奖励将减少 10 分钟（若达标）
              </div>
            )}
          </div>
          <div className="col">
            <div className="badge good">游戏时间余额：{balance} 分钟</div>
            <div style={{ height: 8 }} />
            <div className={"badge " + (earned > 0 ? "good" : "warn")}>
              今日可得：{earned} 分钟
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              基础 {breakdown.base || 0} / 阅读奖励{" "}
              {breakdown.bonusReading || 0} / 运动奖励{" "}
              {breakdown.bonusExercise || 0}
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 10 }} className="badge danger">
            {err}
          </div>
        )}

        <hr />
        <div className="row">
          {statusPills.map((p, idx) => (
            <div key={idx} className={"badge " + (p.ok ? "good" : "danger")}>
              {p.label}
            </div>
          ))}
        </div>

        <div style={{ height: 12 }} />
        <div className="row">
          <a className="btn secondary" href={`#/checkin?day=${day}`}>
            去打卡
          </a>
          <a className="btn secondary" href={`#/notes?day=${day}`}>
            写读书笔记
          </a>
          <a className="btn secondary" href={`#/redeem`}>
            兑现游戏时间
          </a>
          <button
            className="btn"
            onClick={async () => {
              try {
                await api.settle(day);
                await load();
              } catch (e) {
                alert(e.message);
              }
            }}
          >
            结算今日奖励
          </button>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          提示：为了避免重复计算，建议每天晚上由家长或学生点击“结算今日奖励”一次。
        </div>
      </div>
    </div>
  );
}
