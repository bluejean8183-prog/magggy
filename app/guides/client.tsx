"use client";

import { useState } from "react";

export default function GuidesClient({ initialBlog, initialCafe }: { initialBlog: string; initialCafe: string }) {
  const [blog, setBlog] = useState(initialBlog);
  const [cafe, setCafe] = useState(initialCafe);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/guides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blog, cafe }),
    });
    setMsg(res.ok ? "✅ 저장되었습니다. 다음 원고 생성부터 바로 적용됩니다." : "❌ 저장 실패");
    setSaving(false);
  };

  const restoreDefaults = async () => {
    if (!confirm("가이드를 기본값으로 되돌릴까요? 수정한 내용은 사라집니다.")) return;
    const res = await fetch("/api/guides");
    const data = await res.json();
    setBlog(data.defaults.blog);
    setCafe(data.defaults.cafe);
    setMsg("기본값을 불러왔습니다. 저장 버튼을 눌러야 적용됩니다.");
  };

  return (
    <>
      <div className="notice">
        💡 노출 알고리즘이 바뀌면 <b>코드 수정 없이 여기서 가이드만 갱신</b>하세요. 모든 원고 생성에 즉시 반영됩니다.<br />
        적용 우선순위: <b>키워드 패턴</b> (패턴 분석에서 저장한 것) &gt; <b>공통 가이드</b> (이 화면) &gt; 기본 프롬프트.
        키워드 패턴과 충돌하는 내용은 패턴이 이깁니다.
      </div>

      <div className="card">
        <h2>📝 블로그 가이드</h2>
        <div className="field">
          <textarea value={blog} onChange={(e) => setBlog(e.target.value)} style={{ minHeight: 340, fontFamily: "monospace", fontSize: 13 }} />
        </div>
      </div>

      <div className="card">
        <h2>☕ 카페 가이드</h2>
        <div className="field">
          <textarea value={cafe} onChange={(e) => setCafe(e.target.value)} style={{ minHeight: 180, fontFamily: "monospace", fontSize: 13 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? "저장 중..." : "💾 저장"}</button>
        <button className="btn" onClick={restoreDefaults}>기본값 복원</button>
        {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
      </div>
    </>
  );
}
