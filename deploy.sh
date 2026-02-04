#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/server"
WEB_DIR="$PROJECT_DIR/web"

API_PORT="${API_PORT:-3001}"
HOST="${HOST:-0.0.0.0}"

PID_FILE="$PROJECT_DIR/.server.pid"
LOG_FILE="$PROJECT_DIR/.server.log"

log() { echo -e "\033[1;32m[deploy]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[warn]\033[0m $*"; }
err(){ echo -e "\033[1;31m[err ]\033[0m $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "缺少命令：$1"; exit 1; }
}

check_layout() {
  if [[ ! -d "$SERVER_DIR" || ! -d "$WEB_DIR" ]]; then
    err "目录结构不完整：需要存在 server/ 和 web/ 目录。"
    err "当前路径：$PROJECT_DIR"
    exit 1
  fi
}

install_deps() {
  log "安装后端依赖（production）..."
  (cd "$SERVER_DIR" && npm install --omit=dev)

  log "安装前端依赖..."
  (cd "$WEB_DIR" && npm install --no-audit --no-fund --loglevel=info)
}

build_web() {
  log "写入 web/.env.production（VITE_API_BASE=.，使用同域）..."
  cat > "$WEB_DIR/.env.production" <<EOF
VITE_API_BASE=.
EOF

  log "构建前端..."
  (cd "$WEB_DIR" && npm run build)
}

start_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      warn "后端已在运行（pid=$pid），跳过启动。"
      return 0
    fi
  fi

  log "启动后端（HOST=$HOST PORT=$API_PORT）..."
  (cd "$SERVER_DIR" && nohup env HOST="$HOST" PORT="$API_PORT" node src/index.js > "$LOG_FILE" 2>&1 & echo $! > "$PID_FILE")
  sleep 1
  log "后端已尝试启动。日志：$LOG_FILE"
}

stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      log "停止后端进程（pid=$pid）..."
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$PID_FILE"
  else
    warn "未找到 pid 文件，跳过停止。"
  fi
}

status_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      log "后端运行中（pid=$pid）"
      return 0
    fi
  fi
  warn "后端未运行。"
}

usage() {
  cat <<EOF
用法：
  ./deploy.sh [build|start|stop|restart|status]

默认行为：build + start
EOF
}

main() {
  check_layout
  need_cmd node
  need_cmd npm

  local cmd="${1:-}"
  case "$cmd" in
    build)
      install_deps
      build_web
      ;;
    start)
      start_server
      ;;
    stop)
      stop_server
      ;;
    restart)
      stop_server
      start_server
      ;;
    status)
      status_server
      ;;
    "" )
      install_deps
      build_web
      start_server
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  if [[ "$cmd" == "" || "$cmd" == "build" ]]; then
    cat <<EOF

部署完成。
后端：HOST=$HOST PORT=$API_PORT
如需对外访问，请确保云服务器防火墙放行该端口。
EOF
  fi
}

main "$@"
