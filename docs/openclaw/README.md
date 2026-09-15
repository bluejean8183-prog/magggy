# 맥미니 OpenClaw 에이전트 구축 가이드 (텔레그램 + 윈도우 PC 통합 관리)

이 문서는 **맥미니에 OpenClaw를 설치해 개인 AI 에이전트를 만들고, 텔레그램으로 대화하며, 윈도우 PC까지 원격으로 관리**하는 전체 과정을 순서대로 설명합니다.

> 기준: OpenClaw 공식 문서(https://docs.openclaw.ai, 2026-09 시점). 버전에 따라 세부 명령이 달라질 수 있으니 막히면 `openclaw doctor`와 공식 문서를 먼저 확인하세요.
>
> 이 가이드의 명령어와 `openclaw/openclaw.example.json`은 **OpenClaw 2026.9.4 CLI로 실제 검증**했습니다 (`openclaw config validate` 통과).

## 어디서 실행하나요?

**전부 맥미니에서 직접 실행합니다.** 이 저장소는 설명서와 스크립트를 담은 것이지, 다른 컴퓨터에서 맥미니를 원격 설치해 주지는 못합니다.

가장 편한 방법:
1. 맥미니에서 VS Code를 열고 이 저장소를 클론합니다 (`git clone https://github.com/bluejean8183-prog/magggy`).
2. VS Code에 Claude Code 확장이 자동 추천됩니다. 설치 후 Claude에게 "`docs/openclaw/README.md`대로 설치 진행해줘"라고 하면 맥미니 안에서 터미널을 직접 다루며 진행합니다.
3. 또는 터미널만 열고 `bash scripts/mac-setup.sh`를 실행합니다.

---

## 0. 전체 구조 이해하기

```
[내 폰: 텔레그램] ──인터넷──▶ [Telegram Bot API]
                                      │
                                      ▼ (봇 토큰으로 폴링)
                     ┌────────────────────────────────┐
                     │  맥미니 = Gateway (두뇌/중앙 서버) │
                     │  - 에이전트 세션, 메모리, 도구      │
                     │  - 채널: telegram                 │
                     │  - exec: 맥미니에서 명령 실행       │
                     └────────────┬───────────────────┘
                                  │ WebSocket :18789 (Tailscale/LAN)
                                  ▼
                     ┌────────────────────────────────┐
                     │  윈도우 PC = Node (손발/원격 단말)  │
                     │  - system.run  (명령 실행)         │
                     │  - screen.snapshot (화면 캡처)     │
                     │  - system.notify (알림)            │
                     └────────────────────────────────┘
```

| 역할 | 기기 | 하는 일 |
|---|---|---|
| **Gateway** | 맥미니 | 항상 켜져 있는 중앙 서버. 텔레그램 메시지를 받아 에이전트를 실행하고, 도구(셸, 브라우저, 파일)를 사용 |
| **Channel** | 텔레그램 | 나와 에이전트가 대화하는 창구 |
| **Node** | 윈도우 PC (나중에 맥북, 폰도 추가 가능) | Gateway에 붙어서 "그 기기에서" 명령 실행·화면 캡처·알림을 수행 |

핵심: **Gateway는 맥미니 하나만** 두고, 다른 기기는 전부 **Node**로 붙입니다. 그러면 텔레그램 한 곳에서 "윈도우에서 ○○ 실행해줘"가 가능해집니다.

---

## 1단계. 맥미니에 OpenClaw 설치

### 1-1. 사전 준비

- macOS 15 (Sequoia) 이상 권장
- Node.js **24.16+ 또는 26.1+** (설치 스크립트가 없으면 자동 설치를 안내함)
- 맥미니는 **잠자기 해제**: 시스템 설정 → 에너지 → "디스플레이가 꺼져 있을 때 자동으로 잠자기 방지" 켜기

### 1-2. 설치 (터미널)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

설치가 끝나면 온보딩 마법사를 실행하고, 백그라운드 데몬(launchd)까지 같이 설치합니다.

```bash
openclaw onboard --install-daemon
```

온보딩에서 묻는 것:
1. **기본 모델 제공자** → Anthropic(Claude) 선택. API 키를 넣거나 `openclaw models auth login`으로 Claude 로그인
2. **브라우저 통합** → 원하면 켜기
3. **데몬 설치** → 예 (맥이 재부팅돼도 자동 실행)

### 1-3. 확인

```bash
openclaw --version
openclaw doctor            # 설정 진단
openclaw gateway status    # Gateway 실행 중인지
openclaw dashboard         # 브라우저에서 Control UI 열기
```

이 저장소의 `scripts/mac-setup.sh`를 실행하면 위 과정을 한 번에 진행합니다.

---

## 2단계. 모델(Claude) 인증

두 가지 중 하나를 고릅니다.

**A. Anthropic API 키** (사용량 과금)

```bash
# ~/.zshrc 에 추가
export ANTHROPIC_API_KEY="sk-ant-..."
```

**B. Claude 구독 OAuth 로그인**

```bash
openclaw models auth login
openclaw models auth list     # 저장된 인증 프로필 확인
```

기본 모델은 `~/.openclaw/openclaw.json`의 `agents.defaults.model`에서 바꿉니다. (예시 파일: `openclaw/openclaw.example.json`)

---

## 3단계. 텔레그램 봇 연결

### 3-1. BotFather로 봇 만들기

1. 텔레그램에서 `@BotFather` 검색 → `/newbot`
2. 봇 표시 이름 입력 (예: `맥미니 비서`)
3. 봇 사용자명 입력 (반드시 `bot`으로 끝남, 예: `magggy_home_bot`)
4. 발급된 **토큰**(`123456789:AAE...`) 복사

### 3-2. OpenClaw에 등록

가장 빠른 방법:

```bash
openclaw channels add --channel telegram --token "<봇 토큰>"
```

또는 `~/.openclaw/openclaw.json`에 직접:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123456789:AAE...",
      dmPolicy: "pairing",              // 모르는 사람은 승인 전까지 차단
      groups: { "*": { requireMention: true } },
    },
  },
}
```

토큰을 파일에 남기기 싫으면 환경변수 `TELEGRAM_BOT_TOKEN`으로 대체할 수 있습니다.

### 3-3. 연결 확인 + 내 계정 승인(페어링)

```bash
openclaw channels status --probe   # 텔레그램 연결 상태
```

1. 텔레그램에서 내 봇에게 아무 메시지나 보냄 → 봇이 **페어링 코드**를 알려줌
2. 맥미니에서 승인:

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <코드>
```

> 페어링 코드는 1시간 후 만료됩니다. 승인 후부터는 내 계정만 봇과 대화 가능합니다.

### 3-4. 그룹에서도 쓰려면

- 봇을 그룹에 초대 → 그룹에서 `/whoami@봇이름` 으로 내 ID 확인 가능
- 텔레그램 봇은 기본 **Privacy Mode**라 멘션한 메시지만 받습니다. 전부 받게 하려면 BotFather `/setprivacy` → Disable 후 봇을 그룹에서 빼고 다시 초대
- 슈퍼그룹 ID는 `-100...`으로 시작하며 `channels.telegram.groups`에 넣습니다

---

## 4단계. 에이전트 성격·규칙 정하기 (워크스페이스)

에이전트는 `~/.openclaw/workspace/` 안의 마크다운 파일을 매 세션 읽습니다.

| 파일 | 역할 |
|---|---|
| `IDENTITY.md` | 이름, 분위기, 이모지 |
| `SOUL.md` | 말투, 성격, 하지 말아야 할 것 |
| `AGENTS.md` | 운영 규칙 (메모리 사용법, 도구 사용 원칙, 우선순위) |
| `USER.md` | 나에 대한 정보, 선호, 진행 중인 프로젝트 |
| `MEMORY.md` | 장기 기억 (에이전트가 스스로 갱신) |
| `memory/YYYY-MM-DD.md` | 일별 로그 |

이 저장소의 `openclaw/workspace/` 안에 한국어 템플릿이 있습니다. 복사해서 시작하세요:

```bash
cp -n openclaw/workspace/*.md ~/.openclaw/workspace/
```

---

## 5단계. 원격 접근 준비 (윈도우가 맥미니 Gateway에 붙을 수 있게)

Gateway의 WebSocket(기본 `127.0.0.1:18789`)은 기본적으로 **맥미니 내부에서만** 열려 있습니다. 윈도우 PC가 붙으려면 외부에서 접근 가능해야 합니다.

### 권장: Tailscale (집 밖에서도 됨, 공개 노출 없음)

1. 맥미니와 윈도우 PC 모두 https://tailscale.com 앱 설치 후 같은 계정으로 로그인
2. 맥미니에서 Gateway 바인드와 인증 토큰 설정:

```bash
openclaw config set gateway.bind tailnet
openclaw config set gateway.auth.token "$(openssl rand -hex 32)"
openclaw config get gateway.auth.token     # 이 값을 윈도우에서 사용
openclaw gateway restart
```

3. 맥미니의 Tailscale IP 확인: `tailscale ip -4` (예: `100.101.102.103`)

### 대안: 같은 집 LAN만

```bash
openclaw config set gateway.bind lan
openclaw config set gateway.auth.token "<긴 무작위 문자열>"
openclaw gateway restart
```

> 규칙: loopback이 아닌 바인드는 **반드시 토큰/비밀번호 인증**을 켜야 합니다. `ws://`는 LAN/Tailnet까지만, 공개 인터넷은 `wss://`만 허용됩니다.

### 대안: SSH 터널 (Tailscale 없이 임시로)

윈도우에서:

```powershell
ssh -N -L 18789:127.0.0.1:18789 <맥유저>@<맥미니IP>
```

그 뒤 윈도우 쪽에서는 `127.0.0.1:18789`로 접속하면 됩니다.

---

## 6단계. 윈도우 PC를 Node로 연결

두 가지 방법이 있습니다. **A(앱)**가 쉽고, **B(CLI)**는 헤드리스·자동화에 좋습니다.

### 방법 A. Windows Hub 앱 (권장)

1. https://github.com/openclaw/openclaw-windows-node/releases/latest 에서
   `OpenClawCompanion-Setup-x64.exe` (또는 ARM이면 `arm64`) 다운로드·설치 (관리자 권한 불필요, Win10 20H2+/Win11)
2. 앱 실행 → **Settings** → **Remote Gateway** 에
   - URL: `ws://<맥미니 Tailscale IP>:18789`
   - Token: 5단계에서 만든 토큰 (또는 setup code)
3. 맥미니에서 페어링 요청 승인:

```bash
openclaw devices list
openclaw devices approve <deviceRequestId>
openclaw nodes pending
openclaw nodes approve <nodeRequestId>
openclaw nodes list          # 윈도우 노드가 보이면 성공
openclaw nodes status        # 연결 상태 + 지원 기능
```

### 방법 B. 윈도우 CLI 노드 (헤드리스)

PowerShell:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
$env:OPENCLAW_GATEWAY_TOKEN = "<토큰>"
openclaw node run --host <맥미니 Tailscale IP> --port 18789 --display-name "win-pc"
```

동작 확인 후 서비스(작업 스케줄러)로 등록해 부팅 시 자동 실행:

```powershell
openclaw node install
openclaw node status
```

이 저장소의 `scripts/windows-node-setup.ps1`이 이 과정을 자동화합니다.

### 6-3. 윈도우 노드 동작 테스트 (맥미니에서)

```bash
openclaw nodes describe --node win-pc
openclaw nodes invoke --node win-pc --command system.which --params '{"bins":["powershell"]}'
openclaw nodes notify --node win-pc --title "테스트" --body "맥미니에서 보냄"
```

### 6-4. 텔레그램에서 윈도우에 명령 내리기

에이전트가 여러 노드 중 어디서 실행할지 정하려면 `tools.exec.node`를 지정하거나 채팅에서 `/exec node=win-pc`처럼 씁니다.

```bash
# 기본 실행 대상을 윈도우로 고정하고 싶을 때 (선택)
openclaw config set 'agents.entries.main.tools.exec.node' "win-pc"
```

이제 텔레그램에서:

> "윈도우 PC에서 디스크 남은 용량 알려줘"
> "윈도우 화면 캡처해서 보내줘"
> "윈도우에서 크롬 실행해줘"

---

## 7단계. 보안·실행 승인 정책 (꼭 읽기)

에이전트가 셸 명령을 실행할 수 있으므로 정책을 명확히 정합니다.

| 모드 (`tools.exec.mode`) | 동작 |
|---|---|
| `deny` | 명령 실행 금지 |
| `allowlist` | 허용 목록만 실행, 나머지 거부 |
| `ask` | 허용 목록은 바로, 나머지는 **나에게 승인 요청** ← 시작 시 권장 |
| `auto` | 허용 목록 외는 리뷰어 모델이 판단 |
| `full` | 묻지 않고 전부 실행 (YOLO) |

프리셋으로 빠르게:

```bash
openclaw exec-policy preset cautious   # ask 모드 (권장 시작점)
openclaw exec-policy show              # 현재 정책 확인
```

윈도우 노드에 별도 정책을 주려면:

```bash
openclaw approvals set --node win-pc --stdin <<'JSON'
{ "version": 1, "defaults": { "security": "allowlist", "ask": "on-miss", "askFallback": "deny" } }
JSON
```

승인 요청은 Control UI(`openclaw dashboard`)나 macOS 앱에 뜨며 **한 번 허용 / 여기서 항상 허용 / 거부** 중 고릅니다. 익숙해진 뒤 `full`로 올리세요.

기타 체크리스트:
- `dmPolicy: "pairing"` 유지 → 모르는 텔레그램 사용자가 봇을 못 씀
- Gateway 바인드를 `lan`/`tailnet`으로 열었으면 토큰 필수
- 노드 승인(`nodes approve`)은 내가 직접 한 요청만
- `openclaw security audit` 로 주기 점검

---

## 8단계. 운영·유지보수

```bash
openclaw gateway status         # 상태
openclaw gateway restart        # 재시작
openclaw logs --follow          # 실시간 로그
openclaw doctor --fix           # 설정 문제 자동 수정
openclaw update                 # 업데이트
openclaw channels status --probe
openclaw nodes list
```

설정 파일 `~/.openclaw/openclaw.json`은 대부분 **저장 즉시 핫리로드**됩니다. 단, 잘못된 키가 있으면 Gateway가 **기동을 거부**하니 수정 후 `openclaw doctor`로 확인하세요.

---

## 확장 아이디어

- **맥북/아이폰 추가**: 각각 macOS 앱(Remote 모드)·iOS 앱을 설치하고 같은 방식으로 노드 승인
- **정기 작업**: 에이전트에게 "매일 아침 9시 윈도우 백업 상태 확인해서 알려줘" 같은 cron/heartbeat 설정
- **여러 에이전트**: `agents.entries`에 용도별 에이전트(업무용/집안용)를 나누고 텔레그램 봇도 따로 둘 수 있음
- **브라우저 자동화**: 온보딩에서 브라우저 통합을 켜면 웹 작업도 위임 가능

---

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `openclaw: command not found` | Node 설치 여부, npm 글로벌 bin 경로가 PATH에 있는지. 터미널 재시작 |
| 텔레그램 봇이 답이 없음 | `openclaw channels status --probe`, 토큰 오타, 페어링 승인 여부, `openclaw logs --follow` |
| Gateway가 안 뜸 | `openclaw doctor` → 설정 파일에 모르는 키가 있으면 기동 거부됨 |
| 윈도우 노드가 안 보임 | Tailscale 양쪽 로그인 여부, `gateway.bind`가 `tailnet`/`lan`인지, 토큰 일치, 맥미니 방화벽에서 18789 허용, `openclaw nodes pending` |
| 명령이 승인 대기만 걸림 | `openclaw exec-policy show`, Control UI에서 승인. 자동화가 필요하면 allowlist에 등록 |
| 맥미니가 자주 잠듦 | 에너지 설정에서 잠자기 방지, 또는 `caffeinate -s` |

## 참고 링크

- 설치: https://docs.openclaw.ai/install
- 텔레그램: https://docs.openclaw.ai/channels/telegram
- 노드: https://docs.openclaw.ai/nodes
- 윈도우: https://docs.openclaw.ai/platforms/windows
- 원격 Gateway: https://docs.openclaw.ai/gateway/remote
- 설정: https://docs.openclaw.ai/gateway/configuration
- 실행 승인: https://docs.openclaw.ai/tools/exec-approvals
- 보안: https://docs.openclaw.ai/gateway/security
