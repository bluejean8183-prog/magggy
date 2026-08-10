import Anthropic from "@anthropic-ai/sdk";
import { FORMATS, type FormatKey } from "./constants";
import type { Job, Post } from "./db";

const client = new Anthropic();

const MODEL = "claude-opus-5";

const POST_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "게시글 제목. 낚시성 없이 자연스럽게" },
    body: { type: "string", description: "게시글 본문. 문단 구분은 빈 줄로" },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "태그 3~5개, # 없이 단어만",
    },
    image_suggestion: {
      type: ["string", "null"],
      description: "이미지를 넣는다면 어떤 사진이 어울리는지 한 줄 제안. 이미지가 불필요하면 null",
    },
  },
  required: ["title", "body", "tags", "image_suggestion"],
  additionalProperties: false,
} as const;

interface GeneratedPost {
  title: string;
  body: string;
  tags: string[];
  image_suggestion: string | null;
  format: string;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ANGLES = [
  "처음 접해본 사람의 시선으로",
  "몇 년째 관심 있던 사람의 시선으로",
  "최근에 고민이 생긴 사람의 시선으로",
  "지인에게 추천받아 알게 된 사람의 시선으로",
  "가격이나 비용이 가장 신경 쓰이는 사람의 시선으로",
  "실패 경험이 있어서 신중해진 사람의 시선으로",
  "바쁜 직장인의 시선으로",
  "꼼꼼하게 비교하고 결정하는 사람의 시선으로",
];

function buildPrompt(job: Job, formatKey: FormatKey, seq: number): { system: string; user: string; targetChars: number } {
  const format = FORMATS.find((f) => f.key === formatKey)!;
  const isBlog = job.channel === "blog";
  const targetChars = isBlog ? randomInt(1500, 2500) : randomInt(job.min_chars, job.max_chars);
  const angle = ANGLES[randomInt(0, ANGLES.length - 1)];

  const system = isBlog
    ? `당신은 네이버 블로그를 육성 중인 개인 블로거입니다. 검색 유입을 노리는 정보성 글을 씁니다.
- 제목에 검색될 만한 키워드를 자연스럽게 포함
- 본문은 소제목/문단 구분이 있는 장문 구조, 경험과 정보가 섞인 진짜 사람의 글
- 광고 티, 과장, 상투적인 AI 말투("~하는 것이 중요합니다" 반복 등) 금지
- 이모지는 아예 안 쓰거나 한두 개만`
    : `당신은 네이버 카페의 평범한 회원입니다. 카페 게시판에 자연스러운 글을 씁니다.
- 실제 회원이 쓴 것 같은 구어체, 완벽하지 않은 문장도 괜찮음
- 광고 티, 과장, 홍보 문구 절대 금지
- 제목은 짧고 캐주얼하게 (카페 글 제목답게)
- 이모티콘/이모지는 아예 안 쓰거나 한두 개만`;

  const user = `주제: ${job.topic}
글 형태: ${format.label} — ${format.hint}
분량: 약 ${targetChars}자 (±20% 허용)
관점: ${angle}
${job.memo ? `참고 메모: ${job.memo}` : ""}
이번 글은 시리즈 중 ${seq}번째 글입니다. 이전 글들과 소재가 겹치지 않도록 이 주제 안에서 구체적인 소재 하나를 스스로 골라 쓰세요.
80% 확률로 image_suggestion을 null로 하고, 20% 확률로만 이미지 제안을 넣으세요.`;

  return { system, user, targetChars };
}

export async function generatePost(job: Job, formatKey: FormatKey, seq: number): Promise<GeneratedPost> {
  const { system, user } = buildPrompt(job, formatKey, seq);
  const isBlog = job.channel === "blog";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: isBlog ? 8000 : 4000,
    output_config: {
      effort: isBlog ? "medium" : "low",
      format: { type: "json_schema", schema: POST_SCHEMA },
    },
    system,
    messages: [{ role: "user", content: user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("생성이 거부되었습니다. 주제나 메모 내용을 조정해보세요.");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("응답에 텍스트가 없습니다.");
  const parsed = JSON.parse(text.text) as Omit<GeneratedPost, "format">;
  return { ...parsed, format: formatKey };
}

export async function generateBatch(job: Job, count: number): Promise<GeneratedPost[]> {
  const formats = JSON.parse(job.formats) as FormatKey[];
  const tasks: Array<() => Promise<GeneratedPost>> = [];
  for (let i = 0; i < count; i++) {
    const formatKey = formats[randomInt(0, formats.length - 1)];
    tasks.push(() => generatePost(job, formatKey, i + 1));
  }

  // 동시 5개 제한으로 순차 소진
  const results: GeneratedPost[] = [];
  const errors: string[] = [];
  for (let i = 0; i < tasks.length; i += 5) {
    const settled = await Promise.allSettled(tasks.slice(i, i + 5).map((t) => t()));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
      else errors.push(String(s.reason?.message ?? s.reason));
    }
  }
  if (results.length === 0) {
    throw new Error(`전부 실패했습니다: ${errors[0] ?? "알 수 없는 오류"}`);
  }
  return results;
}

const DERIVE_PROMPTS: Record<string, { system: string; instruction: string }> = {
  threads: {
    system: `당신은 스레드(Threads)에서 팔로워를 키우는 크리에이터입니다. 짧고 훅이 강한 글을 씁니다.`,
    instruction: `아래 원고를 스레드 게시글로 변환하세요.
- 500자 이내, 첫 문장이 스크롤을 멈추게 하는 훅
- 줄바꿈으로 리듬감 있게, 해시태그는 쓰지 않음
- 원고의 핵심 하나만 뽑아서 압축 (전부 담으려 하지 말 것)
- title에는 훅 첫 문장을 넣고, tags는 빈 배열, image_suggestion은 null`,
  },
  instagram: {
    system: `당신은 인스타그램 캡션을 쓰는 크리에이터입니다.`,
    instruction: `아래 원고를 인스타그램 캡션으로 변환하세요.
- 800자 이내, 첫 줄이 매력적이어야 함 (더보기 전에 보이는 부분)
- 문단은 짧게, 줄바꿈 활용
- tags에 한국어 해시태그용 키워드 8~12개 (# 없이)
- image_suggestion에 함께 올릴 사진/카드뉴스 아이디어 제안`,
  },
};

export async function derivePost(original: Post, channel: "threads" | "instagram"): Promise<GeneratedPost> {
  const prompt = DERIVE_PROMPTS[channel];
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: POST_SCHEMA },
    },
    system: prompt.system,
    messages: [
      {
        role: "user",
        content: `${prompt.instruction}

--- 원고 ---
제목: ${original.title}

${original.body}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("변환이 거부되었습니다.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("응답에 텍스트가 없습니다.");
  const parsed = JSON.parse(text.text) as Omit<GeneratedPost, "format">;
  return { ...parsed, format: null as unknown as string };
}
