import React, { useEffect, useState } from "react";
import { api } from "../api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState(null);

  async function load() {
    const d = await api.adminGetDay(day);
    setData(d);
  }
  useEffect(() => {
    load();
  }, [day]);

  const r = data?.record;
  const calc = data?.calc;

  return (
    <div className="container">
      <div className="card">
        <div className="h1">家长端</div>

        <label>选择日期</label>
        <input
          className="input"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />

        <div style={{ height: 10 }} />
        {!r && <div className="muted">当天还没有学生打卡记录</div>}

        {r && (
          <>
            <div className="row" style={{ marginTop: 10 }}>
              <div
                className={
                  "badge " + (r.screen_minutes <= 90 ? "good" : "danger")
                }
              >
                屏幕：{r.screen_minutes} 分钟
              </div>
              <div className={"badge " + (r.homework_done ? "good" : "danger")}>
                作业：{r.homework_done ? "完成" : "未完成"}
              </div>
              <div
                className={
                  "badge " + (r.reading_minutes >= 30 ? "good" : "danger")
                }
              >
                阅读：{r.reading_minutes} 分钟
              </div>
              <div
                className={
                  "badge " + (r.exercise_minutes >= 25 ? "good" : "danger")
                }
              >
                运动：{r.exercise_minutes} 分钟
              </div>
              <div
                className={
                  "badge " + (data?.notesCount >= 1 ? "good" : "danger")
                }
              >
                笔记：{data?.notesCount} 条
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div className="badge warn">
              计算结果：{calc?.earned ?? 0} 分钟（基础{" "}
              {calc?.breakdown?.base || 0} / 阅读奖励{" "}
              {calc?.breakdown?.bonusReading || 0} / 运动奖励{" "}
              {calc?.breakdown?.bonusExercise || 0}）
            </div>

            <hr />
            <div
              className="row"
              style={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <div>
                <div className="h1" style={{ fontSize: 14, margin: 0 }}>
                  家长检查（决定是否发放“超额奖励”）
                </div>
                <div className="muted">
                  未勾选则只给基础奖励，不给额外阅读/运动奖励
                </div>
              </div>
              <input
                type="checkbox"
                checked={!!r.parent_checked}
                onChange={async (e) => {
                  await api.adminCheck(day, e.target.checked);
                  await load();
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
