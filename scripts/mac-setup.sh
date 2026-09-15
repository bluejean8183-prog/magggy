#!/usr/bin/env bash
# 맥미니 OpenClaw Gateway 설치 스크립트
# 사용법: bash scripts/mac-setup.sh
# 하는 일: OpenClaw 설치 → 온보딩(데몬 포함) → 워크스페이스 템플릿 복사 → 텔레그램 봇 등록(선택) → 상태 확인
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== 1/5 OpenClaw 설치 =="
if command -v openclaw >/dev/null 2>&1; then
  echo "이미 설치됨: $(openclaw --version)"
else
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
  # 설치 스크립트가 PATH를 갱신했을 수 있으므로 셸 설정을 다시 읽음
  # shellcheck disable=SC1090
  [ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" || true
  command -v openclaw >/dev/null 2>&1 || { echo "openclaw 명령을 찾을 수 없습니다. 터미널을 다시 열고 재실행하세요."; exit 1; }
fi

echo "== 2/5 온보딩 (모델 인증 + 백그라운드 데몬 설치) =="
if [ ! -f "$HOME/.openclaw/openclaw.json" ]; then
  openclaw onboard --install-daemon
else
  echo "설정 파일이 이미 있어 온보딩을 건너뜁니다: ~/.openclaw/openclaw.json"
fi

echo "== 3/5 워크스페이스 템플릿 복사 (기존 파일은 덮어쓰지 않음) =="
mkdir -p "$HOME/.openclaw/workspace"
cp -n "$REPO_DIR"/openclaw/workspace/*.md "$HOME/.openclaw/workspace/" || true
ls "$HOME/.openclaw/workspace"

echo "== 4/5 텔레그램 봇 등록 =="
read -r -p "BotFather에서 받은 봇 토큰을 입력하세요 (건너뛰려면 Enter): " BOT_TOKEN
if [ -n "${BOT_TOKEN}" ]; then
  openclaw channels add --channel telegram --token "${BOT_TOKEN}"
  openclaw config set channels.telegram.dmPolicy pairing
fi

echo "== 5/5 상태 확인 =="
openclaw doctor || true
openclaw gateway status || true
openclaw channels status --probe || true

cat <<'MSG'

다음 할 일:
 1. 텔레그램에서 봇에게 아무 메시지나 보내기 → 페어링 코드 확인
 2. 맥미니에서:  openclaw pairing list telegram && openclaw pairing approve telegram <코드>
 3. 윈도우 PC를 붙이려면 docs/openclaw/README.md 5~6단계 참고
    (Tailscale 설치 후)
      openclaw config set gateway.bind tailnet
      openclaw config set gateway.auth.token "$(openssl rand -hex 32)"
      openclaw gateway restart
MSG
