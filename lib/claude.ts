import Anthropic from "@anthropic-ai/sdk";
import { FORMATS, type FormatKey } from "./constants";
import type { Job, Post } from "./db";
import { resolveEngine } from "./engine";

const engine = resolveEngine();

const MODEL = "claude-opus-5";

// ── 공용 구조화 호출 ──────────────────────────────────────────────

interface StructuredCallOpts {
  system: string;
  user: string;
  maxTokens: number;
  effort: "low" | "medium";
  schema: object;
  jsonInstruction: string;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(text.slice(start, end + 1));
}

async function callViaApi(opts: StructuredCallOpts): Promise<unknown> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    output_config: {
      effort: opts.effort,
      format: { type: "json_schema", schema: opts.schema as Record<string, unknown> },
    },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("생성이 거부되었습니다. 입력 내용을 조정해보세요.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("응답에 텍스트가 없습니다.");
  return JSON.parse(text.text);
}

async function callViaAgentSdk(opts: StructuredCallOpts): Promise<unknown> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  let resultText = "";
  let errorText = "";

  for await (const message of query({
    prompt: opts.user + opts.jsonInstruction,
    options: {
      systemPrompt: opts.system,
      allowedTools: [],
      maxTurns: 1,
      ...(process.env.MAGGGY_MODEL ? { model: process.env.MAGGGY_MODEL } : {}),
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success") resultText = message.result;
      else errorText = message.subtype;
    }
  }

  if (!resultText) {
    throw new Error(
      errorText
        ? `생성 실패 (${errorText}). 맥에서 Claude Code에 로그인되어 있는지 확인하세요 (터미널에서 claude 실행 후 로그인).`
        : "생성 결과가 비어있습니다."
    );
  }
  return extractJson(resultText);
}

async function callViaGemini(opts: StructuredCallOpts): Promise<unknown> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user + opts.jsonInstruction }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini 오류: ${data?.error?.message ?? res.status}`);
  }
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini 응답이 비어있습니다.");
  return extractJson(text);
}

async function callStructured(opts: StructuredCallOpts): Promise<unknown> {
  if (engine === "claude-api") return callViaApi(opts);
  if (engine === "gemini") return callViaGemini(opts);
  return callViaAgentSdk(opts);
}

// ── 원고 생성 ────────────────────────────────────────────────────

const POST_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "게시글 제목. 낚시성 없이 자연스럽게" },
    body: { type: "string", description: "게시글 본문. 문단 구분은 빈 줄로. 이미지가 들어갈 자리는 [사진1], [사진2] 형식으로 표시" },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "태그 3~5개, # 없이 단어만",
    },
    image_suggestion: {
      type: ["string", "null"],
      description: "각 [사진N] 자리에 어떤 사진이 들어가야 하는지 촬영/수급 가이드. 이미지가 불필요하면 null",
    },
    image_prompt: {
      type: ["string", "null"],
      description: "AI 이미지 생성용 영문 프롬프트 ([사진N]별로 줄바꿈 구분). AI 이미지를 쓰지 않으면 null",
    },
  },
  required: ["title", "body", "tags", "image_suggestion", "image_prompt"],
  additionalProperties: false,
} as const;

const POST_JSON_INSTRUCTION = `

응답은 반드시 아래 형식의 JSON 객체 하나만 출력하세요. JSON 앞뒤에 다른 텍스트나 코드블록 표시를 붙이지 마세요.
{"title": "제목", "body": "본문 (문단 구분은 빈 줄, 이미지 자리는 [사진1] 형식)", "tags": ["태그1", "태그2", "태그3"], "image_suggestion": "사진 가이드 또는 null", "image_prompt": "AI 이미지 영문 프롬프트 또는 null"}`;

interface GeneratedPost {
  title: string;
  body: string;
  tags: string[];
  image_suggestion: string | null;
  image_prompt: string | null;
  format: string;
}

type RawPost = Omit<GeneratedPost, "format">;

function validatePost(raw: unknown): RawPost {
  const parsed = raw as RawPost;
  if (!parsed?.title || !parsed?.body) throw new Error("응답 JSON에 제목/본문이 없습니다.");
  if (!Array.isArray(parsed.tags)) parsed.tags = [];
  if (typeof parsed.image_suggestion !== "string") parsed.image_suggestion = null;
  if (typeof parsed.image_prompt !== "string") parsed.image_prompt = null;
  return parsed;
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

function buildPrompt(job: Job, formatKey: FormatKey, seq: number, patternGuide?: string): { system: string; user: string } {
  const format = FORMATS.find((f) => f.key === formatKey)!;
  const isBlog = job.channel === "blog";
  const targetChars = isBlog ? randomInt(1500, 2500) : randomInt(job.min_chars, job.max_chars);
  const angle = ANGLES[randomInt(0, ANGLES.length - 1)];

  const system = isBlog
    ? `당신은 네이버 블로그를 육성 중인 개인 블로거입니다. 검색 유입을 노리는 정보성 글을 씁니다.
- 제목에 검색될 만한 키워드를 자연스럽게 포함
- 본문은 소제목/문단 구분이 있는 장문 구조, 경험과 정보가 섞인 진짜 사람의 글
- 광고 티, 과장, 상투적인 AI 말투("~하는 것이 중요합니다" 반복 등) 금지
- 이모지는 아예 안 쓰거나 한두 개만
- 건강·의료 관련 내용은 일반 상식 수준으로만 다루고, 확정적인 효능·치료 주장 금지. 필요하면 전문가 상담을 권하는 문장으로 마무리`
    : `당신은 네이버 카페의 평범한 회원입니다. 카페 게시판에 자연스러운 글을 씁니다.
- 실제 회원이 쓴 것 같은 구어체, 완벽하지 않은 문장도 괜찮음
- 광고 티, 과장, 홍보 문구 절대 금지
- 제목은 짧고 캐주얼하게 (카페 글 제목답게)
- 이모티콘/이모지는 아예 안 쓰거나 한두 개만`;

  const patternSection = patternGuide
    ? `

[상위 노출 글 분석 기반 스타일 가이드 — 아래 지침을 최우선으로 따르세요. 분량 지시와 충돌하면 가이드를 우선합니다]
${patternGuide}`
    : "";

  // 이미지 지침: 블로그는 이미지가 필수적, 카페는 20% 확률만
  const imageMode = job.image_mode || "real";
  const imageBase = isBlog
    ? `본문에 이미지 자리를 [사진1], [사진2] 형식으로 2~4곳 표시하세요.`
    : `80% 확률로 이미지 없이 쓰고(image_suggestion과 image_prompt 모두 null), 20% 확률로만 본문에 [사진1] 자리 하나를 넣으세요.`;
  const imageModeInstruction =
    imageMode === "ai"
      ? `이미지는 AI로 생성합니다. image_prompt에 각 [사진N]별 영문 이미지 생성 프롬프트를 작성하세요 (사실적인 스마트폰 사진 스타일, 한국의 일상적인 환경, 과하게 완벽하지 않은 자연스러운 구도). image_suggestion에는 각 사진이 본문 어디에 왜 들어가는지 한글로 설명하세요.`
      : imageMode === "mix"
        ? `이미지마다 실제 사진이 나은지 AI 생성이 나은지 판단하세요. 직접 찍기 쉬운 장면(음식, 제품, 장소)은 image_suggestion에 촬영 가이드로, 연출이 어렵거나 개념적인 장면(비교표, 분위기 컷, 인포그래픽)은 image_prompt에 영문 AI 프롬프트로 제공하세요.`
        : `이미지는 실제 사진을 사용합니다. image_suggestion에 각 [사진N]별로 어떤 사진을 찍거나 구해야 하는지 구체적인 가이드를 작성하세요 (구도, 담을 대상, 분위기). image_prompt는 null로 하세요.`;

  const user = `주제: ${job.topic}
글 형태: ${format.label} — ${format.hint}
분량: 약 ${targetChars}자 (±20% 허용)
관점: ${angle}
${job.memo ? `참고 메모: ${job.memo}` : ""}${patternSection}
이번 글은 시리즈 중 ${seq}번째 글입니다. 이전 글들과 소재가 겹치지 않도록 이 주제 안에서 구체적인 소재 하나를 스스로 골라 쓰세요.
${imageBase}
${imageModeInstruction}`;

  return { system, user };
}

export async function generatePost(job: Job, formatKey: FormatKey, seq: number, patternGuide?: string): Promise<GeneratedPost> {
  const { system, user } = buildPrompt(job, formatKey, seq, patternGuide);
  const isBlog = job.channel === "blog";
  const raw = await callStructured({
    system,
    user,
    maxTokens: isBlog ? 8000 : 4000,
    effort: isBlog ? "medium" : "low",
    schema: POST_SCHEMA,
    jsonInstruction: POST_JSON_INSTRUCTION,
  });
  return { ...validatePost(raw), format: formatKey };
}

export async function generateBatch(job: Job, count: number, patternGuide?: string): Promise<GeneratedPost[]> {
  const formats = JSON.parse(job.formats) as FormatKey[];
  const tasks: Array<() => Promise<GeneratedPost>> = [];
  for (let i = 0; i < count; i++) {
    const formatKey = formats[randomInt(0, formats.length - 1)];
    tasks.push(() => generatePost(job, formatKey, i + 1, patternGuide));
  }

  // API/Gemini 모드는 동시 5개, Agent SDK 모드(맥스 요금제)는 프로세스를 띄우므로 동시 2개
  const concurrency = engine === "claude-max" ? 2 : 5;
  const results: GeneratedPost[] = [];
  const errors: string[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const settled = await Promise.allSettled(tasks.slice(i, i + concurrency).map((t) => t()));
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

// ── 파생 (스레드/인스타) ─────────────────────────────────────────

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
  const user = `${prompt.instruction}

--- 원고 ---
제목: ${original.title}

${original.body}`;

  const raw = await callStructured({
    system: prompt.system,
    user,
    maxTokens: 4000,
    effort: "low",
    schema: POST_SCHEMA,
    jsonInstruction: POST_JSON_INSTRUCTION,
  });
  return { ...validatePost(raw), format: null as unknown as string };
}

// ── 상위 노출 패턴 분석 ──────────────────────────────────────────

const PATTERN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "이 키워드의 상위 노출 패턴 한 줄 요약" },
    guide: {
      type: "string",
      description: "원고 생성 시 그대로 따를 수 있는 구체적인 스타일 가이드 (마크다운)",
    },
  },
  required: ["summary", "guide"],
  additionalProperties: false,
} as const;

const PATTERN_JSON_INSTRUCTION = `

응답은 반드시 아래 형식의 JSON 객체 하나만 출력하세요. JSON 앞뒤에 다른 텍스트나 코드블록 표시를 붙이지 마세요.
{"summary": "한 줄 요약", "guide": "스타일 가이드 (마크다운)"}`;

export async function analyzePattern(keyword: string, samples: string): Promise<{ summary: string; guide: string }> {
  const system = `당신은 네이버 검색 상위 노출 패턴을 분석하는 블로그 SEO 전문가입니다.
주어진 상위 노출 글들의 공통 패턴을 찾아, 다른 글을 쓸 때 그대로 따라할 수 있는 실행 가능한 가이드를 만듭니다.
근거 없는 일반론이 아니라 주어진 글들에서 실제로 관찰되는 패턴만 담으세요.`;

  const user = `키워드: "${keyword}"

아래는 이 키워드로 네이버 검색 시 상위 노출된 글들입니다 (--- 로 구분).
공통 패턴을 분석해서 스타일 가이드를 작성하세요.

guide에 반드시 포함할 항목:
1. 제목 공식 — 키워드 위치, 제목 길이, 숫자/연도/후킹 요소 사용 여부
2. 글 분량 — 관찰된 글자수 범위와 권장 분량
3. 글 구조 — 도입부 쓰는 법, 소제목 개수와 스타일, 마무리 방식
4. 키워드 배치 — 본문에서 키워드가 반복되는 횟수와 위치 (도입/소제목/본문)
5. 어투와 형식 — 존댓말/반말, 경험담 비중, 목록 사용, 이미지가 들어가는 지점
6. 이 키워드에서 잘 먹히는 소재 각도 2~3개

--- 상위 노출 글 ---
${samples}`;

  const raw = await callStructured({
    system,
    user,
    maxTokens: 8000,
    effort: "medium",
    schema: PATTERN_SCHEMA,
    jsonInstruction: PATTERN_JSON_INSTRUCTION,
  });

  const parsed = raw as { summary: string; guide: string };
  if (!parsed?.summary || !parsed?.guide) throw new Error("분석 결과가 올바르지 않습니다.");
  return parsed;
}
