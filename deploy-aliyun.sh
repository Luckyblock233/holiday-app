#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/server"
WEB_DIR="$PROJECT_DIR/web"

API_PORT="${API_PORT:-3001}"
HOST="${HOST:-0.0.0.0}"

PID_FILE="$PROJECT_DIR/.server.pid"
LOG_FILE="$PROJECT_DIR/.server.log"

NGINX_CONF_SRC_HTTP="$PROJECT_DIR/nginx/holiday-app.conf"
NGINX_CONF_SRC_HTTPS="$PROJECT_DIR/nginx/holiday-app-https.conf"
NGINX_CONF_DST="/etc/nginx/conf.d/holiday-app.conf"
SYSTEMD_SERVICE_SRC="$PROJECT_DIR/systemd/holiday-app.service"
SYSTEMD_SERVICE_DST="/etc/systemd/system/holiday-app.service"

log() { echo -e "\033[1;32m[deploy-aliyun]\033[0m $*"; }
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
}

install_system_deps() {
  log "安装系统依赖（Alibaba Cloud Linux 3 / dnf）..."
  sudo dnf -y install git curl ca-certificates nginx \
    gcc gcc-c++ make python3 openssl-devel
}

install_node_20_if_missing() {
  if have_cmd node; then
    log "检测到 Node：$(node -v)"
    return 0
  fi

  log "安装 Node.js 20 LTS（NodeSource）..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf -y install nodejs
}

install_deps() {
  log "安装后端依赖（production）..."
  (cd "$SERVER_DIR" && npm install --omit=dev)

  log "安装前端依赖..."
  (cd "$WEB_DIR" && npm install --no-audit --no-fund --loglevel=info)
}

build_web() {
  log "写入 web/.env.production（VITE_API_BASE=/）..."
  cat > "$WEB_DIR/.env.production" <<EOF
VITE_API_BASE=/
EOF

  log "构建前端..."
  (cd "$WEB_DIR" && npm run build)
}

start_server_bg() {
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

install_systemd_service() {
  if [[ ! -f "$SYSTEMD_SERVICE_SRC" ]]; then
    warn "未找到 systemd 服务文件：$SYSTEMD_SERVICE_SRC"
    return 0
  fi

  log "安装 systemd 服务..."
  sudo cp "$SYSTEMD_SERVICE_SRC" "$SYSTEMD_SERVICE_DST"
  sudo systemctl daemon-reload
  sudo systemctl enable --now holiday-app
  sudo systemctl status holiday-app --no-pager || true
}

install_nginx_conf() {
  if [[ ! -f "$NGINX_CONF_SRC_HTTP" ]]; then
    warn "未找到 Nginx 配置模板：$NGINX_CONF_SRC_HTTP"
    return 0
  fi

  log "安装 Nginx 配置..."
  sudo cp "$NGINX_CONF_SRC_HTTP" "$NGINX_CONF_DST"
  sudo nginx -t
  sudo systemctl enable --now nginx
  sudo systemctl reload nginx
}

usage() {
  cat <<EOF
用法：
  ./deploy-aliyun.sh [build|start|systemd|nginx|all]

默认行为：all（安装依赖 + 构建 + 启动 + systemd + nginx）
EOF
}

main() {
  check_layout
  need_cmd sudo
  need_cmd curl

  local cmd="${1:-all}"
  case "$cmd" in
    build)
      install_system_deps
      install_node_20_if_missing
      need_cmd node
      need_cmd npm
      install_deps
      build_web
      ;;
    start)
      start_server_bg
      ;;
    systemd)
      install_systemd_service
      ;;
    nginx)
      install_nginx_conf
      ;;
    all)
      install_system_deps
      install_node_20_if_missing
      need_cmd node
      need_cmd npm
      install_deps
      build_web
      start_server_bg
      install_systemd_service
      install_nginx_conf
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  cat <<EOF

完成：
- 后端默认监听：$HOST:$API_PORT
- Nginx（如启用）代理到 127.0.0.1:$API_PORT

如需 HTTPS，请先在 nginx/holiday-app-https.conf 中替换域名，
然后用 certbot 申请证书后再替换 /etc/nginx/conf.d/holiday-app.conf。
EOF
}

main "$@"
