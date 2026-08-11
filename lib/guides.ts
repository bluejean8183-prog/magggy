import db from "./db";

// 공통 가이드 기본값. 노출 로직이 바뀌면 UI(/guides)에서 수정 — 코드 수정 불필요.
// 초기값 출처: blog-automation post-template.md + 대행사 강의 (정책 위반 없는 요소만)

export const DEFAULT_BLOG_GUIDE = `## 제목
- 25자 이내. 메인 키워드는 제목 앞쪽에 1회만 자연스럽게 (같은 키워드 반복 금지)
- 담백하게: "강남 스테이크 맛집 데이트 코스 추천" O / "강남에서 찾은 진짜 강남 맛집" X

## 키워드 배치
- 1,500자 기준 메인 키워드 10~12회 자연스럽게 본문에 (과도한 반복은 어뷰징 감점)
- 세부 키워드(데이트코스·회식장소·주차 같은 롱테일) 2~3개를 각 3~5회 섞기
- 소제목에 세부 키워드 배치 — 검색 의도별 블록(스마트블록)에 여러 개 걸리게

## 구조 & 체류시간
- 서론 3~4줄: 검색자의 고민 공감 + 이 글에서 얻어갈 것 한 줄 예고
- 검색 의도에 대한 핵심 답변은 상단에 빠르게
- 사진 자리 → 3~4줄 글 → 사진 자리 리듬 반복. 문단은 2~3문장마다 빈 줄
- 가장 궁금해할 대표 정보(음식/결과물)는 중반 이후 배치해 스크롤 유도
- 영업시간·가격·일정·조건 같은 팩트는 인용구/목록/표로 정리 (가독성 + 정보성 점수)
- 소제목 3~5개, 질문형 소제목 섞기 ("얼마나 받나요?" "언제까지 신청하죠?")
- 마무리: 요약 + 관련 다음 글 예고

## 형식
- 1,500자 이상
- 장소·업체 소개 글이면 본문 끝에 [플레이스 링크] 자리 표시
- 숫자·날짜·금액은 문장 앞쪽에 또는 굵게 강조 (강조는 소제목당 1~2개만)`;

export const DEFAULT_CAFE_GUIDE = `## 카페 글 원칙
- 실제 회원이 쓴 것처럼: 완벽하지 않은 문장, 구어체, 짧은 제목
- 글자수 300~800자 랜덤 유지 (일정한 분량은 기계적 패턴으로 감점)
- 질문형 글은 진짜 궁금한 사람처럼 구체적인 상황 설명 포함
- 후기 글은 사소한 단점 한 가지를 섞어 신뢰도 확보
- 광고 티 나는 표현("강추", "인생템", 과도한 감탄) 자제`;

export async function getGuide(channel: string): Promise<string> {
  const key = channel === "blog" ? "guide_blog" : "guide_cafe";
  const row = (await db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)) as { value: string } | undefined;
  return row?.value ?? (channel === "blog" ? DEFAULT_BLOG_GUIDE : DEFAULT_CAFE_GUIDE);
}

export async function setGuide(channel: string, value: string) {
  const key = channel === "blog" ? "guide_blog" : "guide_cafe";
  await db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}
