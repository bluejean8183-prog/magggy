# 윈도우에서 Claude Code로 직접 처리하기

Claude Code를 PC에 설치하면, 콘솔에 코드를 붙여넣을 필요 없이
**Claude가 크롬을 직접 조종해서** 판매중지를 대신 처리합니다.

---

## 1단계 · Claude Code 데스크톱 앱 설치 (터미널 안 씁니다)

https://claude.com/download 에서 윈도우용을 받아 설치하고 실행합니다.
설치 후 평소 쓰시는 Claude 계정으로 로그인하면 끝입니다.

> 참고: 터미널이 익숙하시면 PowerShell에서 `irm https://claude.ai/install.ps1 | iex` 로도 설치됩니다.
> 하지만 데스크톱 앱이 더 쉽습니다.

## 2단계 · 이 저장소 내려받기

Claude Code 앱에서 폴더를 여는 화면이 나오면, 이 저장소(`magggy`)를 받아 둔 폴더를 선택합니다.
아직 안 받으셨다면 앱에 이렇게 말하면 알아서 해줍니다.

```
https://github.com/bluejean8183-prog/magggy 를 내려받고
claude/11st-bulk-product-stop-a9xwkf 브랜치로 바꿔줘
```

## 3단계 · 이 한 줄만 입력

폴더를 연 다음 Claude Code에 이렇게 말하면 됩니다.

```
CLAUDE.md 읽고 11번가 일괄 판매중지 작업 이어서 진행해줘
```

`CLAUDE.md`에 지금까지의 상황과 절차가 전부 적혀 있어서, 그 다음부터는 Claude가
Node.js 설치 확인 → 의존성 설치 → 크롬 실행 → 진단 → 시험 실행 → 전량 실행까지 안내하며 진행합니다.

**사용자분이 직접 하실 일은 딱 하나입니다.** Claude가 크롬을 띄워주면,
그 크롬에서 11번가 셀러오피스에 로그인하고
**상품관리 → 판매상품 조회/수정 → 판매상태 `판매중`으로 조회**해 두시면 됩니다.

---

## 내부적으로 어떻게 동작하나

1. `automation/start-chrome.bat` 이 크롬을 원격 디버깅 포트(9222)로 띄웁니다.
   - 전용 프로필(`%USERPROFILE%\11st-automation-profile`)을 사용합니다.
     크롬 136부터 기본 프로필에서는 원격 디버깅이 막혀 있기 때문입니다.
   - 평소 쓰시는 크롬 프로필/북마크/로그인은 전혀 건드리지 않습니다.
   - 대신 이 전용 프로필에서 11번가 로그인을 한 번 해주셔야 합니다.
2. `automation/bulk-stop.mjs` 가 그 크롬에 붙어서 조작합니다.
   - 목록 개수 select 를 찾아 500으로 설정
   - 전체선택 체크박스 클릭 (안 먹히면 행별 개별 클릭)
   - "판매중지" 버튼 클릭
   - `confirm`/`alert` 창은 자동 확인, 레이어 팝업이면 "확인" 버튼 클릭
   - 목록이 갱신될 때까지 기다렸다가 다음 배치
   - 배치마다 `automation/logs/batch-N.png` 스크린샷 저장

## 명령어 (Claude가 대신 실행합니다)

```bash
cd automation
npm install

node bulk-stop.mjs --inspect        # 화면 진단만, 아무것도 안 바꿈
node bulk-stop.mjs --dry-run        # 전체선택까지만
node bulk-stop.mjs --batches=1      # 실제 실행, 500개만
node bulk-stop.mjs --batches=10     # 실제 실행, 약 5000개
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--batches=N` | `1` | 반복 횟수 |
| `--page-size=N` | `500` | 한 페이지 상품 수 |
| `--delay=N` | `3000` | 배치 사이 대기(ms). 실패가 잦으면 8000으로 |
| `--tab=N` | 자동 | 탭 여러 개일 때 직접 지정 |
| `--cdp=주소` | `http://127.0.0.1:9222` | 크롬 디버깅 주소 |
| `--no-shot` | — | 스크린샷 저장 안 함 |

## 안전장치

- 기본이 1배치. 전량 실행은 명시적으로 `--batches=10` 을 줘야 돕니다.
- 판매중지 버튼을 못 찾으면 실행하지 않고 종료
- 선택된 상품이 0개면 종료
- 목록이 갱신되지 않으면(처리 실패 가능성) 즉시 종료
- 배치마다 스크린샷을 남겨 무슨 일이 있었는지 확인 가능

## 그래도 어려우면

콘솔 붙여넣기 방식이 예비로 남아 있습니다 → [11st-bulk-stop.md](11st-bulk-stop.md)
