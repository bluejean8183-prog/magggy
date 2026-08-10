export const TOPICS = [
  "가전제품", "건강기능식품", "공구(DIY)", "다이어트", "다이어트제품", "대출",
  "맘카페", "맛집", "반려동물", "법률", "보험", "부동산", "성형", "여행",
  "연애", "요양", "웨딩", "인터넷가입", "일상", "주식", "취업", "치과",
  "코인", "피부과", "핸드폰", "화장품",
] as const;

export const FORMATS = [
  { key: "basic", label: "기본 치환용", hint: "평범한 일상 공유 글. 특별한 목적 없이 자연스럽게 쓴 느낌" },
  { key: "review", label: "상세 후기형", hint: "직접 써보고/가보고/해보고 남기는 구체적인 경험 후기" },
  { key: "recommend", label: "추천 게시글", hint: "괜찮았던 것을 다른 사람에게 추천하는 글" },
  { key: "tips", label: "정보 공유/꿀팁형", hint: "알아두면 좋은 정보나 꿀팁을 공유하는 글" },
  { key: "compare", label: "비교 분석형", hint: "두세 가지 선택지를 비교하고 장단점을 정리하는 글" },
  { key: "list", label: "추천 리스트형", hint: "몇 가지를 목록으로 묶어 소개하는 글" },
  { key: "question", label: "질문형 게시글", hint: "궁금한 것을 물어보는 글. 답변을 유도해 댓글 활성화" },
] as const;

export type FormatKey = (typeof FORMATS)[number]["key"];

export const DAILY_COUNTS = [5, 10, 20] as const;

export const CHANNELS = {
  cafe: "네이버 카페",
  blog: "네이버 블로그",
  threads: "스레드",
  instagram: "인스타그램",
} as const;

export type Channel = keyof typeof CHANNELS;

export const POST_STATUS = {
  draft: "초안",
  published: "발행 완료",
  discarded: "버림",
} as const;
