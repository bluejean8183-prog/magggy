"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Pattern } from "@/lib/db";

function patternAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt.replace(" ", "T")).getTime()) / 86400000);
}

function PatternCard({ pattern, onChanged }: { pattern: Pattern; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [newSamples, setNewSamples] = useState("");
  const [msg, setMsg] = useState("");
  const age = patternAgeDays(pattern.created_at);

  const remove = async () => {
    if (!confirm(`"${pattern.keyword}" 패턴을 삭제할까요? 연결된 작업은 패턴 없이 생성됩니다.`)) return;
    setBusy(true);
    await fetch(`/api/patterns/${pattern.id}`, { method: "DELETE" });
    onChanged();
    setBusy(false);
  };

  const reanalyze = async () => {
    if (newSamples.trim().length < 200) return setMsg("❌ 최신 상위 글을 2개 이상 붙여넣어 주세요.");
    setBusy(true);
    setMsg("⏳ 재분석 중... (1분 정도 걸릴 수 있어요)");
    const res = await fetch(`/api/patterns/${pattern.id}/reanalyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samples: newSamples.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(`❌ ${data.error || "재분석 실패"}`);
    } else {
      setMsg("✅ 가이드가 최신 상위 글 기준으로 갱신되었습니다.");
      setReanalyzing(false);
      setNewSamples("");
      onChanged();
    }
    setBusy(false);
  };

  return (
    <div className="post-card">
      <div className="pc-head">
        <div className="pc-title">🔑 {pattern.keyword}</div>
        <div className="pc-meta">
          <span>#{pattern.id}</span>
          <span>{pattern.created_at.slice(0, 10)} 분석</span>
          {age >= 30 && (
            <span className="badge discarded">⏰ {age}일 경과 — 재분석 권장</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 14, color: "#374151", marginBottom: 8 }}>{pattern.summary}</div>
      {open && (
        <div className="pc-body expanded" style={{ background: "#fafbff", padding: 14, borderRadius: 8, marginTop: 8 }}>
          {pattern.guide}
        </div>
      )}
      {reanalyzing && (
        <div style={{ marginTop: 10 }}>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>&quot;{pattern.keyword}&quot;로 지금 검색했을 때의 최신 상위 노출 글 붙여넣기 (2~5개, --- 구분)</label>
            <textarea value={newSamples} onChange={(e) => setNewSamples(e.target.value)} style={{ minHeight: 160 }} />
          </div>
          <button className="btn sm primary" onClick={reanalyze} disabled={busy}>재분석 실행</button>
        </div>
      )}
      {msg && <div style={{ marginTop: 8, fontSize: 13 }}>{msg}</div>}
      <div className="pc-actions">
        <button className="btn sm" onClick={() => setOpen(!open)}>{open ? "가이드 접기" : "📖 가이드 보기"}</button>
        <button className="btn sm" onClick={() => setReanalyzing(!reanalyzing)} disabled={busy}>
          {reanalyzing ? "재분석 취소" : "🔄 재분석"}
        </button>
        <button className="btn sm" onClick={remove} disabled={busy} style={{ marginLeft: "auto", color: "#bf360c" }}>삭제</button>
      </div>
    </div>
  );
}

export default function PatternsClient({ initialPatterns }: { initialPatterns: Pattern[] }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [samples, setSamples] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState("");

  const analyze = async () => {
    setMsg("");
    if (!keyword.trim()) return setMsg("❌ 키워드를 입력하세요.");
    if (samples.trim().length < 200) return setMsg("❌ 상위 노출 글을 2개 이상 붙여넣어 주세요.");

    setAnalyzing(true);
    setMsg("⏳ 패턴 분석 중... (1분 정도 걸릴 수 있어요)");
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), samples: samples.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setMsg(`✅ "${data.keyword}" 패턴 저장 완료. 작업 추가 화면에서 이 패턴을 연결하세요.`);
      setKeyword("");
      setSamples("");
      router.refresh();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "분석 실패"}`);
    }
    setAnalyzing(false);
  };

  return (
    <>
      <div className="card">
        <h2>새 패턴 분석</h2>
        <div className="notice">
          💡 <b>사용법</b>: 네이버에서 원하는 키워드로 검색 → 상위에 노출된 블로그 글 <b>2~5개</b>의
          제목과 본문을 통째로 복사 → 아래에 붙여넣기 (글 사이는 <b>---</b> 로 구분).<br />
          분석된 패턴을 작업에 연결하면, 생성되는 원고가 상위 노출 글의 제목 공식·분량·구조·어투를 그대로 따라갑니다.
        </div>
        <div className="field">
          <label>키워드</label>
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 수원 이유식 카페" />
        </div>
        <div className="field">
          <label>상위 노출 글 붙여넣기 (2~5개, 글 사이는 --- 로 구분)</label>
          <textarea value={samples} onChange={(e) => setSamples(e.target.value)} style={{ minHeight: 260 }}
            placeholder={"첫 번째 글 제목\n첫 번째 글 본문...\n\n---\n\n두 번째 글 제목\n두 번째 글 본문..."} />
          <div className="hint">{samples.length.toLocaleString()}자 입력됨</div>
        </div>
        <button className="btn primary" onClick={analyze} disabled={analyzing}>
          {analyzing ? "⏳ 분석 중..." : "🔍 패턴 분석하기"}
        </button>
        {msg && <div style={{ marginTop: 12, fontSize: 13 }}>{msg}</div>}
      </div>

      <div className="section-label">저장된 패턴 <span className="count">({initialPatterns.length}건)</span></div>
      {initialPatterns.length === 0 ? (
        <div className="card"><div className="empty">아직 분석한 패턴이 없습니다.</div></div>
      ) : (
        initialPatterns.map((p) => <PatternCard key={p.id} pattern={p} onChanged={() => router.refresh()} />)
      )}
    </>
  );
}
