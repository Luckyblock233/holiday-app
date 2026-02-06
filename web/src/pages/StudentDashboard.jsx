import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import SecureImage from "../components/SecureImage.jsx";
import { getLocalDateISO } from "../date";

function todayISO() {
  return getLocalDateISO();
}

export default function StudentDashboard() {
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState(null);
  const [balance, setBalance] = useState(0);
  const [games, setGames] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const [d, b, g] = await Promise.all([
        api.getDay(day),
        api.myBalance(),
        api.games(),
      ]);
      setData(d);
      setBalance(b.balance);
      setGames(g.items || []);
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
        ok: r.exercise_minutes >= 20,
      },
    ];
  }, [data]);
  const completion = statusPills.length
    ? Math.round(
        (statusPills.filter((p) => p.ok).length / statusPills.length) * 100
      )
    : 0;

  return (
    <div className="container py-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h1">学生端</div>
            <div className="muted">查看当日状态并完成打卡</div>
          </div>
          <div className="min-w-[200px]">
            <label>选择日期</label>
            <input
              className="input"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
        </div>

        {data?.yesterdayScreenViolated && (
          <div className="mt-3 badge warn">
            昨天屏幕超时：今天基础奖励将减少 10 分钟（若达标）
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3">
            <div className="muted">游戏时间余额</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {balance} 分钟
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3">
            <div className="muted">今日可得</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {earned} 分钟
            </div>
            <div className="muted mt-1">
              基础 {breakdown.base || 0} / 阅读奖励{" "}
              {breakdown.bonusReading || 0} / 运动奖励{" "}
              {breakdown.bonusExercise || 0}
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-3 badge danger">
            {err}
          </div>
        )}

        <hr />
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <div>打卡完成度</div>
            <div className="font-semibold text-slate-900">{completion}%</div>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusPills.map((p, idx) => (
            <div key={idx} className={"badge " + (p.ok ? "good" : "danger")}>
              {p.label}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a className="btn secondary w-full justify-center" href={`#/checkin?day=${day}`}>
            去打卡
          </a>
          <a className="btn secondary w-full justify-center" href={`#/notes?day=${day}`}>
            写读书笔记
          </a>
        </div>
      </div>

      <div className="card">
        <div className="h1">规则说明</div>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          <div>1. 学生：打卡 + 写笔记 +（可选）上传佐证</div>
          <div>2. 晚上由家长点击一次“结算今日奖励”</div>
          <div>3. 家长：查看记录并勾选“家长检查”决定是否发放超额奖励</div>
        </div>
        <div className="muted mt-2">
          当前逻辑：基础奖励不要求家长检查；超额奖励需要家长检查
        </div>
      </div>

      <div className="card">
        <div className="h1">当前可以游玩的游戏库</div>
        {games.length === 0 && <div className="muted mt-2">暂无内容</div>}
        <div className="mt-3 space-y-4">
          {games.map((game) => (
            <div key={game.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft">
              <div className="text-lg font-semibold text-slate-900">
                {game.title}
              </div>
              {game.description && (
                <div className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                  {game.description}
                </div>
              )}
              {game.images?.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {game.images.map((url, idx) => {
                    const isExternal = /^https?:\/\//i.test(url || "");
                    if (isExternal) {
                      return (
                        <img
                          key={`${game.id}_${idx}`}
                          className="h-32 w-full rounded-xl object-cover"
                          src={url}
                          alt={game.title}
                          loading="lazy"
                        />
                      );
                    }
                    return (
                      <SecureImage
                        key={`${game.id}_${idx}`}
                        className="h-32 w-full rounded-xl object-cover"
                        src={url}
                        alt={game.title}
                      />
                    );
                  })}
                </div>
              )}
              {game.linkUrl && (
                <div className="mt-3">
                  <a
                    className="btn secondary w-full justify-center sm:w-auto"
                    href={game.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {game.linkLabel || "打开链接"}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
