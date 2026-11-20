#!/bin/zsh
# 봇을 쓸 수 있는 텔레그램 계정(숫자 ID)을 지정 — 비밀 값이 아니라서 화면에 보여도 괜찮아요.
#
# 사용법:
#   zsh set-telegram-users.sh boss  123456789               ← 사장님 ID 하나만
#   zsh set-telegram-users.sh staff 123456789,987654321     ← 직원 ID들 (쉼표로 구분, 띄어쓰기 없이)
#
# 사장봇은 TELEGRAM_HOME_CHANNEL(정기 요약을 받을 곳)도 사장님 ID로 같이 설정해요.

set -e
profile="$1"; ids="$2"
if [[ -z "$profile" || -z "$ids" ]]; then
  echo "사용법: zsh set-telegram-users.sh <boss|staff> <ID,ID,...>"; exit 1
fi
if [[ ! "$ids" =~ '^[0-9]+(,[0-9]+)*$' ]]; then
  echo "숫자 ID만, 쉼표로 구분해서 넣어 주세요 (예: 123456789,987654321)"; exit 1
fi
envfile="$HOME/.hermes/profiles/$profile/.env"
[[ -d "${envfile:h}" ]] || { echo "프로필이 없어요: $profile"; exit 1; }

touch "$envfile"; chmod 600 "$envfile"
tmp="$(mktemp)"
grep -v -E "^(TELEGRAM_ALLOWED_USERS|GATEWAY_ALLOW_ALL_USERS)=" "$envfile" > "$tmp" || true
if [[ "$profile" == "boss" ]]; then
  if [[ "$ids" == *,* ]]; then echo "사장봇에는 사장님 ID 하나만 넣어 주세요."; rm -f "$tmp"; exit 1; fi
  grep -v "^TELEGRAM_HOME_CHANNEL=" "$tmp" > "$tmp.2" || true; mv "$tmp.2" "$tmp"
  print -r -- "TELEGRAM_HOME_CHANNEL=${ids}" >> "$tmp"
fi
print -r -- "TELEGRAM_ALLOWED_USERS=${ids}" >> "$tmp"
print -r -- "GATEWAY_ALLOW_ALL_USERS=false" >> "$tmp"
cat "$tmp" > "$envfile"; rm -f "$tmp"

echo "✅ $profile 봇 허용 계정: $ids"
