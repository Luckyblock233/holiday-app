import React, { useEffect, useState } from "react";
import { api, openSecureFile } from "../api";
import SecureImage from "../components/SecureImage.jsx";
import { formatChinaDateTime, getLocalDateISO } from "../date";

function todayISO() {
  return getLocalDateISO();
}

export default function AdminDashboard() {
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState(null);
  const [balance, setBalance] = useState(0);
  const [uploadsByCategory, setUploadsByCategory] = useState({});
  const [uploadsPage, setUploadsPage] = useState(1);
  const [uploadsTotal, setUploadsTotal] = useState(0);
  const [games, setGames] = useState([]);
  const [gameErr, setGameErr] = useState("");
  const [gameUploading, setGameUploading] = useState({});
  const [newGameUploading, setNewGameUploading] = useState(false);
  const uploadsPageSize = 9;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adjustMinutes, setAdjustMinutes] = useState(10);
  const [adjustType, setAdjustType] = useState("add");
  const [adjustNote, setAdjustNote] = useState("");
  const [newGame, setNewGame] = useState({
    title: "",
    description: "",
    linkUrl: "",
    linkLabel: "",
    images: [""],
    sortOrder: 0,
  });

  async function load() {
    try {
      setErr("");
      const [d, b, u, g] = await Promise.all([
        api.adminGetDay(day),
        api.myBalance(),
        api.adminUploads(day, { page: uploadsPage, pageSize: uploadsPageSize }),
        api.adminGames(),
      ]);
      setData(d);
      setBalance(b.balance);
      setUploadsByCategory(u.categories || {});
      setUploadsTotal(u.total || 0);
      setGames(g.items || []);
      setGameErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [day, uploadsPage]);

  useEffect(() => {
    setUploadsPage(1);
  }, [day]);

  const r = data?.record;
  const calc = data?.calc;
  const uploadCategories = Object.keys(uploadsByCategory || {});

  function isImageUpload(upload) {
    if (upload?.mime && upload.mime.startsWith("image/")) return true;
    if (!upload?.url) return false;
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(upload.url);
  }

  const completionItems = r
    ? [
        r.screen_minutes <= 90,
        !!r.homework_done,
        r.reading_minutes >= 30,
        r.exercise_minutes >= 20,
        (data?.notesCount || 0) >= 1,
      ]
    : [];
  const completion = completionItems.length
    ? Math.round(
        (completionItems.filter(Boolean).length / completionItems.length) * 100
      )
    : 0;

  function updateGame(id, patch) {
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  }

  function updateGameImage(id, idx, value) {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const images = Array.isArray(g.images) ? [...g.images] : [];
        images[idx] = value;
        return { ...g, images };
      })
    );
  }

  function addGameImage(id) {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const images = Array.isArray(g.images) ? [...g.images] : [];
        images.push("");
        return { ...g, images };
      })
    );
  }

  function removeGameImage(id, idx) {
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const images = Array.isArray(g.images) ? [...g.images] : [];
        images.splice(idx, 1);
        return { ...g, images };
      })
    );
  }

  async function uploadGameImages(files, { onSuccess, onDone, onError }) {
    const list = Array.from(files || []).filter(Boolean);
    if (list.length === 0) return;
    try {
      setGameErr("");
      const urls = [];
      for (const file of list) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.adminUploadGameImage(formData);
        if (res?.fileUrl) urls.push(res.fileUrl);
      }
      if (urls.length) onSuccess(urls);
    } catch (e) {
      if (onError) onError(e);
      else setGameErr(e.message);
    } finally {
      if (onDone) onDone();
    }
  }

  function renderThumb(url, key) {
    const isExternal = /^https?:\/\//i.test(url || "");
    if (isExternal) {
      return (
        <img
          key={key}
          className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
          src={url}
          alt=""
          loading="lazy"
        />
      );
    }
    return (
      <SecureImage
        key={key}
        className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
        src={url}
        alt=""
      />
    );
  }

  return (
    <div className="container py-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h1">家长端</div>
            <div className="muted">查看孩子今日表现并管理奖励</div>
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

        <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50 p-3">
          <div className="muted">游戏时间余额</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {balance} 分钟
          </div>
        </div>
        {err && <div className="mt-3 badge danger">{err}</div>}

        <div className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <a className="btn secondary w-full justify-center" href="#/redeem">
              兑现游戏时间
            </a>
            <button
              className="btn w-full"
              disabled={!r || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.settle(day);
                  await load();
                  alert("已结算");
                } catch (e) {
                  alert(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              结算今日奖励
            </button>
          </div>

          {!r && <div className="muted mt-3">当天还没有学生打卡记录</div>}

          {r && (
            <>
              <div className="mb-4 rounded-xl border border-slate-200/70 bg-slate-50 p-3">
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
                <div
                  className={
                    "badge " + (r.screen_minutes <= 90 ? "good" : "danger")
                  }
                >
                  屏幕：{r.screen_minutes} 分钟
                </div>
                <div
                  className={"badge " + (r.homework_done ? "good" : "danger")}
                >
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
                    "badge " + (r.exercise_minutes >= 20 ? "good" : "danger")
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

              <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50 p-3 text-amber-700">
                <div className="text-sm font-semibold">
                  计算结果：{calc?.earned ?? 0} 分钟
                </div>
                <div className="muted mt-1 text-amber-700">
                  基础 {calc?.breakdown?.base || 0} / 阅读奖励{" "}
                  {calc?.breakdown?.bonusReading || 0} / 运动奖励{" "}
                  {calc?.breakdown?.bonusExercise || 0}
                </div>
              </div>

              <hr />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
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

              <div className="mt-4" />
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="h1">额外奖励与惩罚</div>
        <div className="muted">
          用于手动增加或减少游戏时间（会记录到流水）
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label>调整类型</label>
            <select
              className="input"
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value)}
            >
              <option value="add">奖励（增加）</option>
              <option value="sub">惩罚（减少）</option>
            </select>
          </div>
          <div>
            <label>分钟数</label>
            <input
              className="input"
              type="number"
              value={adjustMinutes}
              onChange={(e) => setAdjustMinutes(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <label>备注（可选）</label>
            <input
              className="input"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            className="btn w-full sm:w-auto"
            disabled={busy || !adjustMinutes}
            onClick={async () => {
              const delta =
                adjustType === "sub"
                  ? -Math.abs(adjustMinutes)
                  : Math.abs(adjustMinutes);
              setBusy(true);
              try {
                await api.adminAdjust(delta, adjustNote, day);
                setAdjustNote("");
                await load();
                alert("已调整");
              } catch (e) {
                alert(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认调整
          </button>
        </div>
      </div>

      <div className="card">
        <div className="h1">游戏库管理</div>
        <div className="muted">新增、编辑或删除学生端展示的游戏条目</div>
        {gameErr && <div className="mt-2 badge danger">{gameErr}</div>}

        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">新增条目</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label>标题</label>
              <input
                className="input"
                value={newGame.title}
                onChange={(e) =>
                  setNewGame((g) => ({ ...g, title: e.target.value }))
                }
              />
            </div>
            <div>
              <label>排序（小到大）</label>
              <input
                className="input"
                type="number"
                value={newGame.sortOrder}
                onChange={(e) =>
                  setNewGame((g) => ({
                    ...g,
                    sortOrder: Number(e.target.value || 0),
                  }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label>说明文字</label>
              <textarea
                className="input"
                rows={3}
                value={newGame.description}
                onChange={(e) =>
                  setNewGame((g) => ({ ...g, description: e.target.value }))
                }
              />
            </div>
            <div>
              <label>链接标题</label>
              <input
                className="input"
                value={newGame.linkLabel}
                onChange={(e) =>
                  setNewGame((g) => ({ ...g, linkLabel: e.target.value }))
                }
              />
            </div>
            <div>
              <label>链接地址</label>
              <input
                className="input"
                value={newGame.linkUrl}
                onChange={(e) =>
                  setNewGame((g) => ({ ...g, linkUrl: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-sm font-semibold text-slate-900">图片地址</div>
            <div className="mt-2 space-y-2">
              {newGame.images.map((url, idx) => (
                <div key={`new_${idx}`} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="https://example.com/image.jpg"
                    value={url}
                    onChange={(e) =>
                      setNewGame((g) => {
                        const images = [...g.images];
                        images[idx] = e.target.value;
                        return { ...g, images };
                      })
                    }
                  />
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() =>
                      setNewGame((g) => {
                        const images = [...g.images];
                        images.splice(idx, 1);
                        return { ...g, images: images.length ? images : [""] };
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            {newGame.images.filter(Boolean).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {newGame.images
                  .filter(Boolean)
                  .map((url, idx) => renderThumb(url, `new_thumb_${idx}`))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="btn secondary"
                type="button"
                onClick={() =>
                  setNewGame((g) => ({ ...g, images: [...g.images, ""] }))
                }
              >
                添加图片地址
              </button>
              <label className="btn secondary cursor-pointer">
                {newGameUploading ? "上传中..." : "上传图片"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  disabled={newGameUploading}
                  onChange={(e) => {
                    const files = e.target.files;
                    e.target.value = "";
                    if (!files || files.length === 0) return;
                    setNewGameUploading(true);
                    uploadGameImages(files, {
                      onSuccess: (urls) =>
                        setNewGame((g) => ({
                          ...g,
                          images: [...g.images.filter(Boolean), ...urls],
                        })),
                      onDone: () => setNewGameUploading(false),
                    });
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mt-4">
            <button
              className="btn w-full sm:w-auto"
              onClick={async () => {
                try {
                  setGameErr("");
                  const payload = {
                    title: newGame.title.trim(),
                    description: newGame.description.trim(),
                    linkUrl: newGame.linkUrl.trim(),
                    linkLabel: newGame.linkLabel.trim(),
                    images: newGame.images.map((i) => i.trim()).filter(Boolean),
                    sortOrder: Number(newGame.sortOrder || 0),
                  };
                  await api.adminCreateGame(payload);
                  setNewGame({
                    title: "",
                    description: "",
                    linkUrl: "",
                    linkLabel: "",
                    images: [""],
                    sortOrder: 0,
                  });
                  await load();
                } catch (e) {
                  setGameErr(e.message);
                }
              }}
            >
              新增条目
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {games.length === 0 && <div className="muted">暂无游戏条目</div>}
          {games.map((game) => (
            <div
              key={game.id}
              className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label>标题</label>
                  <input
                    className="input"
                    value={game.title}
                    onChange={(e) => updateGame(game.id, { title: e.target.value })}
                  />
                </div>
                <div>
                  <label>排序（小到大）</label>
                  <input
                    className="input"
                    type="number"
                    value={game.sortOrder ?? 0}
                    onChange={(e) =>
                      updateGame(game.id, { sortOrder: Number(e.target.value || 0) })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label>说明文字</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={game.description || ""}
                    onChange={(e) =>
                      updateGame(game.id, { description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>链接标题</label>
                  <input
                    className="input"
                    value={game.linkLabel || ""}
                    onChange={(e) =>
                      updateGame(game.id, { linkLabel: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>链接地址</label>
                  <input
                    className="input"
                    value={game.linkUrl || ""}
                    onChange={(e) =>
                      updateGame(game.id, { linkUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-sm font-semibold text-slate-900">图片地址</div>
                <div className="mt-2 space-y-2">
                  {(game.images || []).map((url, idx) => (
                    <div key={`${game.id}_${idx}`} className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="https://example.com/image.jpg"
                        value={url}
                        onChange={(e) =>
                          updateGameImage(game.id, idx, e.target.value)
                        }
                      />
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => removeGameImage(game.id, idx)}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
                {(game.images || []).filter(Boolean).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(game.images || [])
                      .filter(Boolean)
                      .map((url, idx) =>
                        renderThumb(url, `${game.id}_thumb_${idx}`)
                      )}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => addGameImage(game.id)}
                  >
                    添加图片地址
                  </button>
                  <label className="btn secondary cursor-pointer">
                    {gameUploading[game.id] ? "上传中..." : "上传图片"}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      disabled={!!gameUploading[game.id]}
                      onChange={(e) => {
                        const files = e.target.files;
                        e.target.value = "";
                        if (!files || files.length === 0) return;
                        setGameUploading((prev) => ({
                          ...prev,
                          [game.id]: true,
                        }));
                        uploadGameImages(files, {
                          onSuccess: (urls) =>
                            setGames((prev) =>
                              prev.map((g) =>
                                g.id === game.id
                                  ? {
                                      ...g,
                                      images: [...(g.images || []), ...urls],
                                    }
                                  : g
                              )
                            ),
                          onDone: () =>
                            setGameUploading((prev) => ({
                              ...prev,
                              [game.id]: false,
                            })),
                        });
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      setGameErr("");
                      const payload = {
                        title: String(game.title || "").trim(),
                        description: String(game.description || "").trim(),
                        linkUrl: String(game.linkUrl || "").trim(),
                        linkLabel: String(game.linkLabel || "").trim(),
                        images: (game.images || []).map((i) => i.trim()).filter(Boolean),
                        sortOrder: Number(game.sortOrder || 0),
                      };
                      await api.adminUpdateGame(game.id, payload);
                      await load();
                    } catch (e) {
                      setGameErr(e.message);
                    }
                  }}
                >
                  保存修改
                </button>
                <button
                  className="btn secondary"
                  onClick={async () => {
                    if (!window.confirm("确定要删除这条游戏条目吗？")) return;
                    try {
                      setGameErr("");
                      await api.adminDeleteGame(game.id);
                      await load();
                    } catch (e) {
                      setGameErr(e.message);
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
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
        <div className="h1">上传证据预览（按分类）</div>
        <div className="mt-1 text-sm text-slate-600">
          第 {uploadsPage} /{" "}
          {Math.max(1, Math.ceil(uploadsTotal / uploadsPageSize))} 页
        </div>
        {uploadCategories.length === 0 && (
          <div className="muted">当天暂无上传</div>
        )}
        {uploadCategories.map((cat) => (
          <div key={cat} className="mt-4">
            <div className="badge">{cat}</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(uploadsByCategory[cat] || []).map((u) => {
                const isImage = isImageUpload(u);
                return (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-soft"
                  >
                    <div className="muted">
                      {formatChinaDateTime(u.created_at)}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      {isImage ? (
                        <SecureImage className="thumb" src={u.url} alt={cat} />
                      ) : (
                        <div className="muted">非图片文件</div>
                      )}
                      <button
                        className="btn secondary whitespace-nowrap"
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
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-4 flex flex-wrap gap-2">
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
