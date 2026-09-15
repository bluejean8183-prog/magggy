# OpenClaw vs Hermes Agent — 내 목적엔 뭐가 맞을까?

목적: **맥미니를 중앙 서버로 두고, 텔레그램으로 대화하며, 윈도우 PC까지 넘나들며 관리하는 봇.**

## 한 줄 결론

**OpenClaw.** 이유는 "다른 기기를 원격 조작"하는 구조(Node)가 OpenClaw에는 정식 기능으로 들어 있고, Hermes에는 없기 때문입니다.

## 두 프로젝트 비교

| 항목 | OpenClaw | Hermes Agent (Nous Research) |
|---|---|---|
| 언어 / 라이선스 | TypeScript / MIT | Python / MIT |
| 철학 | **내가 규칙을 쓰는 워크스페이스** (SOUL.md, AGENTS.md 등 마크다운으로 성격·규칙 정의) | **스스로 배우는 에이전트** (쓰다 보면 스킬을 자동 생성·개선) |
| 텔레그램 | 지원 (페어링 승인 방식) | 지원 |
| 다른 메신저 | WhatsApp, Discord, Slack, iMessage, Teams 등 20+ | Telegram, Discord, Slack, WhatsApp, Signal, Email + Matrix/IRC/KakaoTalk 등 더 넓음 |
| **다른 기기 원격 제어** | **Node 구조 내장**: 윈도우/맥/iOS/Android 앱이 Gateway에 붙어 `system.run`(명령 실행), `screen.snapshot`(화면 캡처), `system.notify`(알림), 카메라 등을 제공. 승인(pairing) 체계 있음 | 네이티브 기능 없음. `SSH 백엔드`로 다른 PC에 명령은 보낼 수 있지만 화면 캡처·알림·앱 형태의 단말 제어는 없음 |
| 윈도우 지원 | Windows Hub 앱(노드) + 네이티브 CLI + WSL2 | 네이티브/WSL2 + 데스크톱 앱(v0.16) — 단, "Gateway에 붙는 단말"이 아니라 "독립 실행" |
| 명령 실행 안전장치 | exec 정책(deny/allowlist/ask/auto/full), 노드별 승인 | 실행 백엔드 선택(local/docker/ssh/modal…), 샌드박스 |
| 모델 | Anthropic, OpenAI, Google, Ollama, OpenRouter 등 | Nous Portal, OpenRouter, OpenAI, Anthropic, Ollama/vLLM 등 |
| 잘 맞는 사람 | 기기 여러 대를 한 봇으로 묶고 싶은 사람, 규칙을 명확히 통제하고 싶은 사람 | 하나의 머신에서 오래 쓰며 봇이 알아서 똑똑해지길 원하는 사람, 메신저 종류가 많이 필요한 사람 |

## 왜 지금 목적엔 OpenClaw인가

1. **"윈도우 PC까지 넘나든다"** = OpenClaw의 Node 기능 그 자체입니다. 윈도우에 Hub 앱만 깔고 맥미니 Gateway에 페어링하면 텔레그램에서 "윈도우에서 ○○ 실행해줘, 화면 캡처해줘"가 바로 됩니다.
2. Hermes로 같은 걸 하려면 윈도우에 OpenSSH 서버를 켜고 SSH 백엔드로 명령만 보내는 식이라, 화면 캡처·알림·GUI 앱 실행 같은 건 직접 만들어야 합니다.
3. 나중에 맥북·아이폰·안드로이드를 추가할 때도 OpenClaw는 앱만 설치하면 됩니다.

## Hermes가 더 나은 경우

- 기기 제어보다 "업무 자동화 스킬을 스스로 쌓아가는 비서"가 목적일 때
- 카카오톡, Matrix, Signal 등 OpenClaw가 우선하지 않는 메신저가 꼭 필요할 때
- Python 생태계에 익숙해서 직접 손보고 싶을 때

두 개를 같이 쓸 수도 있습니다 (예: OpenClaw는 기기 관리, Hermes는 리서치 비서). 하지만 처음엔 하나로 시작하는 게 관리가 쉽습니다.

## 참고
- https://github.com/openclaw/openclaw
- https://github.com/NousResearch/hermes-agent
- 비교 글: https://composio.dev/content/openclaw-vs-hermes-agent , https://parallel.ai/articles/openclaw-vs-nousresearch-hermes
