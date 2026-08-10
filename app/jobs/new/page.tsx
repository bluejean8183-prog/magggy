"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOPICS, FORMATS, DAILY_COUNTS, IMAGE_MODES } from "@/lib/constants";
import type { Pattern } from "@/lib/db";

export default function NewJobPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<"cafe" | "blog">("cafe");
  const [targetName, setTargetName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [dailyCount, setDailyCount] = useState(5);
  const [memo, setMemo] = useState("");
  const [imageMode, setImageMode] = useState<string>("real");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternId, setPatternId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patterns")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setPatterns(data))
      .catch(() => {});
  }, []);

  const finalTopic = topic === "__custom__" ? customTopic.trim() : topic;

  const toggleFormat = (key: string) =>
    setFormats((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));

  const submit = async () => {
    setError("");
    if (!targetName.trim()) return setError("대상 이름을 입력하세요.");
    if (!finalTopic) return setError("주제를 선택하거나 입력하세요.");
    if (formats.length === 0) return setError("글 형태를 1개 이상 선택하세요.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          target_name: targetName.trim(),
          target_url: targetUrl.trim(),
          topic: finalTopic,
          formats,
          daily_count: dailyCount,
          min_chars: 300,
          max_chars: 800,
          memo: memo.trim(),
          pattern_id: patternId,
          image_mode: imageMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      router.push(`/jobs/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록 실패");
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="page-title"><span>＋</span>작업 추가</h1>

      <div className="card">
        <h2>1. 대상 정보</h2>
        <div className="field">
          <label>채널</label>
          <div className="radio-row" style={{ maxWidth: 480 }}>
            <button type="button" className={`radio-card ${channel === "cafe" ? "selected" : ""}`} onClick={() => setChannel("cafe")}>
              네이버 카페
              <span className="sub">300~800자 랜덤 · 회원 말투</span>
            </button>
            <button type="button" className={`radio-card ${channel === "blog" ? "selected" : ""}`} onClick={() => setChannel("blog")}>
              네이버 블로그
              <span className="sub">1,500~2,500자 장문 · 검색 키워드</span>
            </button>
          </div>
        </div>
        <div className="field">
          <label>{channel === "cafe" ? "카페 이름" : "블로그 이름"}</label>
          <input type="text" value={targetName} onChange={(e) => setTargetName(e.target.value)}
            placeholder={channel === "cafe" ? "예: 강남맘 육아카페" : "예: 일상의 재테크 블로그"} />
        </div>
        <div className="field">
          <label>URL (선택)</label>
          <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
            placeholder={channel === "cafe" ? "https://cafe.naver.com/..." : "https://blog.naver.com/..."} />
        </div>
      </div>

      <div className="card">
        <h2>2. 게시글 세팅</h2>
        <div className="field">
          <label>주제 (1개만 선택)</label>
          <div className="chips">
            {TOPICS.map((t) => (
              <button key={t} type="button" className={`chip ${topic === t ? "selected" : ""}`} onClick={() => setTopic(t)}>
                {t}
              </button>
            ))}
            <button type="button" className={`chip ${topic === "__custom__" ? "selected" : ""}`} onClick={() => setTopic("__custom__")}>
              ✏️ 직접 입력
            </button>
          </div>
          {topic === "__custom__" && (
            <input type="text" style={{ marginTop: 10, width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="주제를 직접 입력하세요 (예: 캠핑용품)" />
          )}
        </div>

        <div className="field">
          <label>글 형태 (복수 선택 가능 — 선택한 형태들이 랜덤으로 섞여 생성됩니다)</label>
          <div className="format-grid">
            {FORMATS.map((f) => (
              <button key={f.key} type="button" className={`format-item ${formats.includes(f.key) ? "selected" : ""}`} onClick={() => toggleFormat(f.key)}>
                <div className="fl">{f.label}</div>
                <div className="fh">{f.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>일일 생성량</label>
          <div className="radio-row" style={{ maxWidth: 360 }}>
            {DAILY_COUNTS.map((c) => (
              <button key={c} type="button" className={`radio-card ${dailyCount === c ? "selected" : ""}`} onClick={() => setDailyCount(c)}>
                {c}개
                <span className="sub">월 {c * 30}개</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>이미지 방식 — 원고에 들어갈 이미지를 어떻게 준비할지</label>
          <div className="radio-row" style={{ maxWidth: 640 }}>
            {IMAGE_MODES.map((m) => (
              <button key={m.key} type="button" className={`radio-card ${imageMode === m.key ? "selected" : ""}`} onClick={() => setImageMode(m.key)}>
                {m.label}
                <span className="sub">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>스타일 가이드 연결 (선택) — 상위 노출 패턴을 원고에 적용</label>
          {patterns.length === 0 ? (
            <div className="hint">
              저장된 패턴이 없습니다. <Link href="/patterns" style={{ color: "var(--accent)" }}>패턴 분석</Link>에서
              상위 노출 글을 분석하면 여기서 연결할 수 있어요.
            </div>
          ) : (
            <div className="chips">
              <button type="button" className={`chip ${patternId === null ? "selected" : ""}`} onClick={() => setPatternId(null)}>
                사용 안 함
              </button>
              {patterns.map((p) => (
                <button key={p.id} type="button" className={`chip ${patternId === p.id ? "selected" : ""}`} onClick={() => setPatternId(p.id)}>
                  🔑 {p.keyword}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>참고 메모 (선택)</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
            placeholder="글에 반영할 배경 정보. 예: 30대 여성 타겟, 지역은 수원, 자연스러운 존댓말 위주" />
        </div>

        <div className="notice">
          💡 카페는 글자수 300~800자 랜덤으로 생성되며, 선택한 <b>글 형태</b>에 맞게 다양한 느낌으로 작성됩니다.<br />
          이미지 제안은 20% 확률로만 포함되어 기계적인 패턴을 피합니다. 블로그는 검색 노출을 고려한 장문으로 생성됩니다.
        </div>
      </div>

      {error && <div className="notice" style={{ borderLeftColor: "#e53935", background: "#ffebee" }}>{error}</div>}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn primary" style={{ flex: 1, padding: 16 }} onClick={submit} disabled={submitting}>
          {submitting ? "등록 중..." : "🚀 작업 등록하기"}
        </button>
      </div>
    </>
  );
}
