# magggy — 마케팅 육성 스튜디오

네이버 블로그/카페 육성용 원고를 대량 생산하는 개인용 Next.js 웹 앱.
연포스트(카페 육성 대행업체)를 벤치마킹해 개인용으로 재구성한 것.
스레드/인스타그램 버전은 원고에서 버튼으로 파생.

## 명령어

```bash
npm run dev     # 개발 서버 (localhost:3000)
npm run build   # 빌드 확인 (커밋 전 필수)
```

## 브랜치 규칙

- 개발 브랜치: `claude/mac-mini-migration-r8u4z5` — 모든 작업은 이 브랜치에서
- 작업 시작 전 `git pull origin claude/mac-mini-migration-r8u4z5`
- 작업 끝나면 커밋 후 같은 브랜치로 푸시 (클라우드 세션과 이 브랜치로 동기화함)

## 구조

- `app/jobs/new` — 작업 추가 (채널/주제/글형태/일일량/이미지방식/패턴 연결)
- `app/jobs` — 작업 현황 (작업중/완료 분리, 통계 카드)
- `app/jobs/[id]` — 작업 상세: 원고 생성·복사·수정·발행체크·파생
- `app/patterns` — 상위 노출 글 붙여넣어 패턴 분석 → 스타일 가이드 저장
- `lib/claude.ts` — 원고 생성 핵심. 프롬프트/스키마 전부 여기
- `lib/engine.ts` — 생성 엔진 선택 로직
- `lib/db.ts` — better-sqlite3, `data/magggy.db` (gitignore됨). 스키마 변경은
  CREATE TABLE + try/catch ALTER 패턴으로 (기존 DB 호환)
- `docs/` — 벤치마킹 분석, 제품 스펙, 영상 학습 노트

## 생성 엔진 (lib/engine.ts)

우선순위: `ANTHROPIC_API_KEY`(Claude API 종량) → `GEMINI_API_KEY`(Gemini) →
없으면 **Claude Code 로그인 인증(Agent SDK, 맥스 요금제 사용량 포함, 별도 과금 없음)**.
맥미니에서는 아무 키 없이 쓰는 게 기본. `MAGGGY_ENGINE`으로 강제 지정 가능.

## 컨벤션

- UI 텍스트는 전부 한국어, 코드는 영어
- 원고 생성 프롬프트 원칙: 광고 티 금지, 실제 사람이 쓴 것 같은 자연스러움,
  글자수·형태·이미지 랜덤화 (기계적 패턴 방지), 건강 콘텐츠는 효능 단정 금지
- 구조화 출력: Claude API는 json_schema, Agent SDK/Gemini는 JSON 지시 + extractJson

## 진행 상황 / 다음 후보

완료: 작업 CRUD, 원고 생성(3엔진), 파생(스레드/인스타), 패턴 분석 + 재분석,
이미지 방식(실사/AI/혼합), 원고 편집, 공통 가이드(/guides, 편집 가능한 노출 가이드 —
우선순위: 키워드 패턴 > 공통 가이드 > 기본 프롬프트), 대행사 강의 인사이트 반영
(제목 25자·키워드 횟수·체류시간 설계 — docs/video-insights.md)

후보: 콘텐츠 캘린더, 키워드 리서치 보조(blog-automation의 naver_keywords.py 이식),
원고를 blog-automation drafts/ 형식으로 내보내 예약발행 파이프라인 연결,
대행사 확장(고객사 축) — docs/video-insights.md 참고
