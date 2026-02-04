#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/server"
WEB_DIR="$PROJECT_DIR/web"

ADMIN_USER="admin"
ADMIN_PWD="admin123"
STUDENT_USER="student"
STUDENT_PWD="student123"

API_PORT="3001"
WEB_PORT="5173"
API_BASE="http://localhost:${API_PORT}"

log() { echo -e "\033[1;32m[setup]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[warn]\033[0m $*"; }
err(){ echo -e "\033[1;31m[err ]\033[0m $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "缺少命令：$1"; exit 1; }
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

check_layout() {
  if [[ ! -d "$SERVER_DIR" || ! -d "$WEB_DIR" ]]; then
    err "目录结构不完整：需要存在 server/ 和 web/ 目录。"
    err "当前路径：$PROJECT_DIR"
    exit 1
  fi
  if [[ ! -f "$SERVER_DIR/package.json" ]]; then
    warn "未发现 server/package.json（你可能还没把后端代码放全）"
  fi
  if [[ ! -f "$WEB_DIR/package.json" ]]; then
    warn "未发现 web/package.json（你可能还没把前端代码放全）"
  fi
}

install_apt_deps() {
  log "安装系统依赖（用于 better-sqlite3 等原生模块编译）..."
  sudo apt update
  sudo apt -y install build-essential python3 make g++ curl ca-certificates gnupg
}

install_node_20_if_missing() {
  if have_cmd node; then
    log "检测到 Node：$(node -v)"
    return 0
  fi

  warn "未检测到 node，开始自动安装 Node.js 20 LTS（NodeSource）..."

  # 某些系统可能只有 nodejs（极少数），先探测一下
  if have_cmd nodejs; then
    warn "检测到 nodejs 但没有 node：$(nodejs -v)"
    # 尝试建立软链接（仅当 /usr/bin/node 不存在）
    if [[ ! -e /usr/bin/node ]]; then
      log "创建软链接 /usr/bin/node -> /usr/bin/nodejs"
      sudo ln -s /usr/bin/nodejs /usr/bin/node || true
    fi
    if have_cmd node; then
      log "已恢复 node 命令：$(node -v)"
      return 0
    fi
    warn "nodejs 存在但 node 仍不可用，将继续安装 NodeSource Node 20 覆盖旧版本。"
  fi

  # NodeSource 安装
  # shellcheck disable=SC1091
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt -y install nodejs

  # 再次兼容：有些奇怪环境可能仍旧只有 nodejs
  if ! have_cmd node && have_cmd nodejs; then
    warn "安装后仍未找到 node，但找到了 nodejs：$(nodejs -v)"
    if [[ ! -e /usr/bin/node ]]; then
      log "创建软链接 /usr/bin/node -> /usr/bin/nodejs"
      sudo ln -s /usr/bin/nodejs /usr/bin/node || true
    fi
  fi

  if ! have_cmd node; then
    err "Node 安装似乎失败：仍未找到 node。"
    err "请执行：which node; which nodejs; nodejs -v（如存在）并把输出发我。"
    exit 1
  fi

  log "Node 安装完成：$(node -v)"
  if have_cmd npm; then
    log "npm 版本：$(npm -v)"
  else
    err "npm 未找到（理论上随 nodejs 一起安装）。请把 apt 安装输出发我。"
    exit 1
  fi
}

check_node_version_min() {
  local ver major
  ver="$(node -v | sed 's/^v//')"
  major="${ver%%.*}"

  if [[ "$major" -lt 18 ]]; then
    warn "你的 Node 版本是 v$ver，建议 >= 18，推荐 20。"
  else
    log "Node 版本 OK：v$ver"
  fi
}

install_deps() {
  if [[ -f "$SERVER_DIR/package.json" ]]; then
    log "安装后端依赖（server）..."
    (cd "$SERVER_DIR" && npm install)
  else
    warn "跳过后端依赖安装：server/package.json 不存在"
  fi

  if [[ -f "$WEB_DIR/package.json" ]]; then
    log "安装前端依赖（web）..."
    (cd "$WEB_DIR" && npm install --no-audit --no-fund --loglevel=info)
  else
    warn "跳过前端依赖安装：web/package.json 不存在"
  fi
}

write_env() {
  log "写入 web/.env（VITE_API_BASE=$API_BASE）..."
  mkdir -p "$WEB_DIR"
  cat > "$WEB_DIR/.env" <<EOF
VITE_API_BASE=${API_BASE}
EOF
}

start_server_bg() {
  log "尝试后台启动后端（用于执行 seed）..."
  if [[ ! -f "$SERVER_DIR/src/index.js" ]]; then
    warn "未发现 server/src/index.js，无法启动后端。跳过自动 seed。"
    return 0
  fi

  # 若端口已占用，跳过启动
  if ss -ltn 2>/dev/null | grep -q ":${API_PORT} "; then
    warn "端口 ${API_PORT} 已在监听，认为后端已启动，跳过启动。"
    return 0
  fi

  (cd "$SERVER_DIR" && nohup node src/index.js > "$PROJECT_DIR/.server.log" 2>&1 & echo $! > "$PROJECT_DIR/.server.pid")
  sleep 1

  # 等待 health
  for i in {1..20}; do
    if curl -fsS "${API_BASE}/api/health" >/dev/null 2>&1; then
      log "后端已启动：${API_BASE}"
      return 0
    fi
    sleep 0.5
  done

  warn "后端启动检测失败。你可以手动启动：cd server && npm run dev"
  warn "查看日志：tail -n 200 $PROJECT_DIR/.server.log"
}

seed_accounts() {
  log "初始化账号（seed）：admin/student ..."
  if ! curl -fsS "${API_BASE}/api/health" >/dev/null 2>&1; then
    warn "无法访问后端 ${API_BASE}，跳过 seed。请先启动后端后手动执行 seed。"
    return 0
  fi

  curl -fsS -X POST "${API_BASE}/api/auth/seed" \
    -H "Content-Type: application/json" \
    -d "{\"adminPwd\":\"${ADMIN_PWD}\",\"studentPwd\":\"${STUDENT_PWD}\"}" >/dev/null || true

  log "seed 已尝试执行（如已存在账号会忽略）。"
}

stop_server_bg() {
  if [[ -f "$PROJECT_DIR/.server.pid" ]]; then
    local pid
    pid="$(cat "$PROJECT_DIR/.server.pid" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      log "停止后台后端进程（pid=$pid）..."
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$PROJECT_DIR/.server.pid"
  fi
}

print_next_steps() {
  cat <<EOF

========================================
✅ 安装与初始化完成（或已尽力执行）
----------------------------------------
下一步（开发模式）请开两个终端：

1) 启动后端：
   cd "$SERVER_DIR"
   npm run dev

2) 启动前端：
   cd "$WEB_DIR"
   npm run dev

打开浏览器：
- 前端：http://localhost:${WEB_PORT}
- 后端健康检查：${API_BASE}/api/health

默认账号：
- 家长端：${ADMIN_USER} / ${ADMIN_PWD}
- 学生端：${STUDENT_USER} / ${STUDENT_PWD}

生产部署（云服务器）可使用：
./deploy.sh

如果 seed 没成功（比如你没启动后端），手动执行：
curl -X POST ${API_BASE}/api/auth/seed \\
  -H "Content-Type: application/json" \\
  -d '{"adminPwd":"${ADMIN_PWD}","studentPwd":"${STUDENT_PWD}"}'

========================================
EOF
}

main() {
  log "项目根目录：$PROJECT_DIR"
  check_layout

  need_cmd sudo
  need_cmd curl

  install_apt_deps
  install_node_20_if_missing
  check_node_version_min

  need_cmd npm

  install_deps
  write_env

  start_server_bg
  seed_accounts
  stop_server_bg

  print_next_steps
}

main "$@"
