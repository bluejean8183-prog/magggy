#!/bin/zsh
# 비밀 값(API 키, 봇 토큰)을 화면에 보이지 않게 입력해서 프로필 .env 에 저장
#
# 사용법:
#   zsh set-secret.sh boss  OPENROUTER_API_KEY
#   zsh set-secret.sh boss  TELEGRAM_BOT_TOKEN
#   zsh set-secret.sh staff OPENROUTER_API_KEY
#   zsh set-secret.sh staff TELEGRAM_BOT_TOKEN
#
# 붙여 넣어도 화면에 아무것도 안 보이는 게 정상이에요. 붙여 넣고 Enter.

set -e
profile="$1"; var="$2"
if [[ -z "$profile" || -z "$var" ]]; then
  echo "사용법: zsh set-secret.sh <boss|staff|default> <변수이름>"; exit 1
fi
case "$var" in
  OPENROUTER_API_KEY|TELEGRAM_BOT_TOKEN) ;;
  *) echo "이 스크립트는 OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN 만 다뤄요."; exit 1;;
esac

if [[ "$profile" == "default" ]]; then
  envfile="$HOME/.hermes/.env"
else
  dir="$HOME/.hermes/profiles/$profile"
  [[ -d "$dir" ]] || { echo "프로필이 없어요: $profile (먼저 hermes profile create $profile)"; exit 1; }
  envfile="$dir/.env"
fi

printf "%s 값을 붙여 넣고 Enter (화면에 안 보여요): " "$var"
read -rs value
echo
value="${value//[$'\t\r\n ']}"
if [[ -z "$value" ]]; then echo "값이 비어 있어요. 다시 실행해 주세요."; exit 1; fi

# 간단한 형식 확인 (값 자체는 출력하지 않음)
if [[ "$var" == "OPENROUTER_API_KEY" && "$value" != sk-or-* ]]; then
  echo "⚠️ OpenRouter 키는 보통 sk-or- 로 시작해요. 맞는 키인지 확인해 주세요."; exit 1
fi
if [[ "$var" == "TELEGRAM_BOT_TOKEN" && ! "$value" =~ '^[0-9]+:[A-Za-z0-9_-]{30,}$' ]]; then
  echo "⚠️ 텔레그램 봇 토큰 형식(숫자:영문...)이 아니에요. 다시 확인해 주세요."; exit 1
fi

touch "$envfile"
chmod 600 "$envfile"
tmp="$(mktemp)"
grep -v "^${var}=" "$envfile" > "$tmp" || true
print -r -- "${var}=${value}" >> "$tmp"
cat "$tmp" > "$envfile"
rm -f "$tmp"
unset value

echo "✅ $var 저장 완료 → $envfile (값은 화면에 표시하지 않아요)"
