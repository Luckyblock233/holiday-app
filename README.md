# 假期打卡系统（React + Node.js + SQLite）

一个轻量的学生端/家长端 Web 应用，用于：

- 每日任务打卡（作业/阅读/运动/屏幕时长）
- 读书笔记录入（至少 1 条/天）
- 佐证材料上传（照片/截图）
- 自动计算奖励游戏时间（含违规处罚与超额奖励）
- 游戏时间余额累计与兑现记录

## 技术栈

- 前端：React + Vite
- 后端：Node.js + Express
- 数据库：SQLite（单文件 `server/holiday.sqlite`）
- 上传存储：本地目录 `server/uploads/`

---

## 目录结构（约定）

```txt
holiday-app/
  server/
    src/
      db.js
      rules.js
      auth.js
      index.js
      routes/
        auth.js
        days.js
        uploads.js
        redemption.js
        admin.js
    uploads/               # 上传文件存储
    holiday.sqlite
    package.json
  web/
    src/
      api.js
      main.jsx
      App.jsx
      styles.css
      auth/
        Login.jsx
      layouts/
        Shell.jsx
      pages/
        StudentDashboard.jsx
        AdminDashboard.jsx
        DayCheckin.jsx
        Notes.jsx
        Redeem.jsx
    package.json
  README.md
```

> 说明：本 README 假设你已经把后端/前端源码放到了对应目录（`server/` 和 `web/`）。

---

## 0) Ubuntu 从零开始（推荐方式）

你可以用项目根目录的一键脚本：

```bash
cd ~/holiday-app
chmod +x setup.sh
./setup.sh
```

脚本会：

- 检查 Node 是否安装（建议 Node 20）
- 安装必要的编译依赖（用于 better-sqlite3）
- 安装 server/web 依赖
- 写入 web/.env（指向本地后端）
- 调用 seed 初始化账号

---

## 1) 手动启动（开发模式）

### 1.1 启动后端

```bash
cd server
npm run dev
```

后端地址：

- `http://localhost:3001`
- 健康检查：`http://localhost:3001/api/health`

### 1.2 初始化账号（只需要一次）

另开一个终端：

```bash
curl -X POST http://localhost:3001/api/auth/seed \
  -H "Content-Type: application/json" \
  -d '{"adminPwd":"admin123","studentPwd":"student123"}'
```

默认账号：

- 家长端：admin / admin123
- 学生端：student / student123

### 1.3 启动前端

```bash
cd web
npm run dev
```

前端地址（通常）：

- `http://localhost:5173`

---

## 2) 运行流程建议（避免“结算”混乱）

- 学生：打卡 + 写笔记 +（可选）上传佐证 → 晚上点一次“结算今日奖励”
- 家长：查看记录 → 勾选“家长检查”决定是否发放“超额奖励”
  （当前逻辑：基础奖励不要求家长检查；超额奖励需要家长检查）

---

## 3) 局域网手机访问（可选）

### 3.1 后端监听 0.0.0.0（如果你需要手机访问）

在 `server/src/index.js`：

```js
app.listen(port, "0.0.0.0", () => console.log("Server on", port));
```

### 3.2 前端 `.env` 指向你的 Ubuntu 局域网 IP

编辑 `web/.env`：

```
VITE_API_BASE=http://192.168.1.10:3001
```

重启前端：

```bash
cd web
npm run dev
```

手机打开：

- `http://192.168.1.10:5173`

---

## 4) 常见问题排查

### 4.1 better-sqlite3 安装失败

确保安装编译环境：

```bash
sudo apt update
sudo apt -y install build-essential python3 make g++
```

再重新安装：

```bash
cd server
rm -rf node_modules package-lock.json
npm i
```

### 4.2 登录失败（401 / CORS）

- 后端是否在运行 `http://localhost:3001/api/health`
- web/.env 的 VITE_API_BASE 是否正确
- 重新启动前端

### 4.3 上传文件打不开

- 后端是否有静态目录：`/uploads`
- 打开链接是否是 `http://localhost:3001/uploads/...`