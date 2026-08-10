// 생성 엔진 선택. MAGGGY_ENGINE으로 강제 지정하거나, 없으면 자동:
// ANTHROPIC_API_KEY → claude-api / GEMINI_API_KEY → gemini / 둘 다 없으면 → claude-max
export type Engine = "claude-api" | "claude-max" | "gemini";

export function resolveEngine(): Engine {
  const forced = process.env.MAGGGY_ENGINE;
  if (forced === "claude-api" || forced === "claude-max" || forced === "gemini") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "claude-api";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "claude-max";
}

export const ENGINE_LABELS: Record<Engine, string> = {
  "claude-max": "Claude 맥스 요금제",
  "claude-api": "Claude API (종량)",
  gemini: "Gemini API",
};
