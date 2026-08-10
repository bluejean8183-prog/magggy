# magggy — 마케팅 육성 스튜디오

네이버 블로그/카페 육성을 위한 원고를 대량 생산하는 웹 앱.
스레드/인스타그램 버전은 만들어진 원고에서 버튼 한 번으로 파생합니다.

## 실행 방법

```bash
npm install
npm run dev                  # http://localhost:3000
```

## 요금 방식 (둘 중 하나, 자동 선택)

| 방식 | 조건 | 과금 |
|---|---|---|
| **A. 맥스/프로 요금제 (추천)** | 이 컴퓨터에 Claude Code 로그인만 되어 있으면 됨 (`claude` 실행 후 로그인) | **별도 과금 없음** — 구독 사용량에 포함 |
| B. Claude API | `.env.local`에 `ANTHROPIC_API_KEY` 설정 | 사용량만큼 종량 과금 |

`ANTHROPIC_API_KEY`가 없으면 자동으로 A 방식(Claude Code 인증)을 사용합니다.
맥스 요금제에도 시간당 사용량 한도는 있으므로, 하루 20개 이상 대량 생성 시
`.env.local`에 `MAGGGY_MODEL=sonnet`을 설정하면 한도를 아낄 수 있습니다.

## 주요 기능

- **작업 추가**: 채널(카페/블로그) → 주제 26종 또는 직접 입력 → 글 형태 7종 → 일일 생성량(5/10/20개)
- **원고 생성**: Claude API로 오늘 분량 일괄 생성 (카페: 300~800자 랜덤, 블로그: 1,500~2,500자 장문)
- **작업 현황**: 작업중/작업완료 분리, 총 원고 수·발행 수 추적
- **원고 관리**: 복사 → 네이버에 붙여넣기 발행 → 발행 완료 체크
- **파생**: 원고에서 스레드(훅 중심 500자) / 인스타 캡션(해시태그 포함) 버전 생성

자세한 내용: [docs/product-spec.md](docs/product-spec.md), [docs/benchmark-yeonpost.md](docs/benchmark-yeonpost.md)

## VS Code에서 Claude Code 실행하기

이 저장소는 VS Code에서 [Claude Code](https://code.claude.com/docs)를 바로 사용할 수 있도록 설정되어 있습니다.
폴더를 열면 `.vscode/extensions.json`에 등록된 Claude Code 확장 설치를 자동으로 제안합니다.

터미널 사용 시: `npm install -g @anthropic-ai/claude-code` 후 `claude` 실행.
공식 문서: https://code.claude.com/docs/en/claude-code-on-the-web
