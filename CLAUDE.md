# magggy — 작업 인수인계 메모

## 지금 진행 중인 일

11번가 셀러오피스에 등록된 판매상품 약 5,000개를 **일괄 판매중지** 처리하는 작업입니다.
사용자는 개발자가 아니며, 브라우저 콘솔에 코드를 붙여넣는 방식이 어렵다고 하셔서
**Claude Code가 사용자 PC의 크롬을 직접 조종해서 처리하는 방식**으로 진행하기로 했습니다.

## 사용자에게 확인된 사항

- 환경: 윈도우
- 목표: 판매중 상품 전체를 판매중지로 변경 (500개씩 × 약 10회)
- 사용자는 터미널 명령 입력을 어려워합니다. **명령은 Claude가 직접 실행**하고,
  사용자에게는 "브라우저에서 로그인해 주세요" 수준의 부탁만 하세요.

## 준비된 것

```
automation/
  package.json      playwright-core 의존성
  start-chrome.bat  원격 디버깅 포트 9222로 크롬 실행 (전용 프로필)
  bulk-stop.mjs     CDP로 붙어서 500개씩 선택 → 판매중지 반복
scripts/
  11st-bulk-stop.js 브라우저 콘솔 붙여넣기용 (예비 수단)
  11st-inspect.js   콘솔용 화면 진단
docs/
  11st-bulk-stop.md 콘솔 방식 사용법
  windows-setup.md  이 PC 방식 사용법
```

## 로컬 세션에서 할 일 (순서대로)

1. **Node.js 확인** — `node --version`. 없으면 https://nodejs.org 의 LTS 설치를
   사용자에게 안내하거나 `winget install OpenJS.NodeJS.LTS` 로 설치.
2. **의존성 설치** — `cd automation && npm install`
3. **크롬 실행** — `automation/start-chrome.bat` 실행.
   → 사용자에게 부탁: 열린 크롬에서 11번가 셀러오피스 로그인 →
     상품관리 → 판매상품 조회/수정 → **판매상태 "판매중" 필터로 조회**.
     (이 필터가 없으면 처리된 상품이 목록에서 빠지지 않아 무한 반복됩니다.)
4. **진단** — `node bulk-stop.mjs --inspect`
   출력에서 다음을 확인하고, 예상과 다르면 `bulk-stop.mjs` 의 셀렉터/라벨을 실제 DOM에 맞게 수정:
   - 목록 개수 select 에 500 옵션이 있는지
   - 행 체크박스 개수가 조회 건수와 맞는지
   - 버튼 목록에 "판매중지"가 있는지 (다른 이름이면 `STOP_LABELS` 수정)
5. **DRY RUN** — `node bulk-stop.mjs --dry-run` 으로 500개 선택까지만 확인
6. **1배치 실행** — `node bulk-stop.mjs --batches=1` 로 500개만 처리.
   `logs/batch-1.png` 와 셀러오피스 화면으로 실제 반영 확인. **여기서 반드시 사용자에게 확인받기.**
7. **전량 실행** — `node bulk-stop.mjs --batches=10`

## 주의

- 판매중지는 되돌리기 번거로운 작업입니다. 6단계 확인 없이 7단계로 넘어가지 마세요.
- 스크립트는 판매중지 버튼을 못 찾거나 / 선택이 0개거나 / 목록이 갱신되지 않으면
  즉시 중단하도록 되어 있습니다. 이 안전장치를 제거하지 마세요.
- 요청이 몰리면 차단될 수 있으니 실패가 잦으면 `--delay=8000` 으로 간격을 늘리세요.
- 크롬 136 이상은 기본 프로필에서 원격 디버깅이 막혀 있어 `start-chrome.bat` 이
  전용 프로필(`%USERPROFILE%\11st-automation-profile`)을 씁니다. 그래서 첫 실행 때
  11번가 로그인을 한 번 새로 해야 합니다. 정상입니다.

## 브랜치

작업 브랜치: `claude/11st-bulk-product-stop-a9xwkf`
