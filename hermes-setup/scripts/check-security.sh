#!/bin/zsh
# 보안 설정 점검 (읽기만 함). 비밀 값은 절대 출력하지 않아요.
# 실행: zsh check-security.sh

H="$HOME/.hermes"
ok=0; bad=0
pass() { echo "  ✅ $1"; ok=$((ok+1)); }
fail() { echo "  ❌ $1"; bad=$((bad+1)); }

envget() { grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2-; }
has()    { [[ -n "$(envget "$1" "$2")" ]]; }

for p in boss staff; do
  dir="$H/profiles/$p"; env="$dir/.env"; cfg="$dir/config.yaml"
  echo "[$p]"
  [[ -d "$dir" ]] || { fail "프로필 폴더 없음"; continue; }

  has "$env" OPENROUTER_API_KEY && pass "OpenRouter 키 있음" || fail "OpenRouter 키 없음"
  has "$env" TELEGRAM_BOT_TOKEN && pass "텔레그램 봇 토큰 있음" || fail "텔레그램 봇 토큰 없음"

  users="$(envget "$env" TELEGRAM_ALLOWED_USERS)"
  if [[ -n "$users" ]]; then pass "허용 계정: $users"; else fail "허용 계정(TELEGRAM_ALLOWED_USERS) 비어 있음"; fi
  if [[ "$p" == boss && "$users" == *,* ]]; then fail "사장봇 허용 계정이 2개 이상"; fi

  allow_all="$(envget "$env" GATEWAY_ALLOW_ALL_USERS; envget "$H/.env" GATEWAY_ALLOW_ALL_USERS)"
  if [[ "$allow_all" == *true* ]]; then fail "모든 사용자 허용(GATEWAY_ALLOW_ALL_USERS=true) 켜져 있음!"; else pass "모든 사용자 허용 꺼짐"; fi

  if [[ "$(stat -f %Lp "$env" 2>/dev/null)" == "600" ]]; then pass ".env 파일 권한 600 (본인만 읽기)"; else fail ".env 권한이 600이 아님 → chmod 600 $env"; fi

  grep -q "data_collection: deny" "$cfg" && pass "학습용 데이터 수집 거부" || fail "data_collection: deny 없음"
  grep -q ":free" "$cfg" && fail "무료(:free) 모델이 설정돼 있음" || pass "무료 모델 아님"
  grep -q "anthropic/" "$cfg" && fail "Claude 모델이 설정돼 있음" || pass "Claude 모델 아님"
  grep -q "mode: manual" "$cfg" && pass "위험 명령 승인 모드: manual" || fail "approvals.mode 가 manual 이 아님"
  grep -qi "yolo" "$cfg" && fail "yolo 관련 설정 발견" || true

  if [[ "$p" == staff ]]; then
    for t in terminal file code_execution browser computer_use memory; do
      awk '/disabled_toolsets:/{f=1;next} f&&/^[^ -]/{f=0} f' "$cfg" | grep -qw "$t" \
        && pass "직원봇 $t 도구 꺼짐" || fail "직원봇 $t 도구가 꺼져 있지 않음"
    done
  fi
  echo
done

if [[ -n "$HERMES_YOLO_MODE" ]]; then fail "HERMES_YOLO_MODE 환경변수가 켜져 있음"; fi
grep -q "dispatch_profiles: \[\]" "$H/config.yaml" 2>/dev/null \
  && pass "[본체] 칸반 작업자 자동 실행 꺼짐" || fail "[본체] kanban.dispatch_profiles: [] 없음"

echo
echo "결과: 통과 $ok / 문제 $bad"
echo "실제 적용된 도구 목록은 이 명령으로 한 번 더 확인해요:"
echo "  hermes -p staff tools --summary"
