"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS, FORMATS, POST_STATUS } from "@/lib/constants";
import type { Job, Post } from "@/lib/db";

function PostCard({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const tags = JSON.parse(post.tags) as string[];
  const formatLabel = FORMATS.find((f) => f.key === post.format)?.label;

  const saveEdit = async () => {
    setBusy("edit");
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "저장 실패");
    } else {
      setEditing(false);
      onChanged();
    }
    setBusy("");
  };

  const copy = async () => {
    const tagLine = tags.length ? "\n\n" + tags.map((t) => `#${t}`).join(" ") : "";
    await navigator.clipboard.writeText(
      post.channel === "threads" ? post.body : `${post.title}\n\n${post.body}${tagLine}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const setStatus = async (status: string) => {
    setBusy(status);
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChanged();
    setBusy("");
  };

  const derive = async (channel: "threads" | "instagram") => {
    setBusy(channel);
    const res = await fetch(`/api/posts/${post.id}/derive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "변환 실패");
    }
    onChanged();
    setBusy("");
  };

  if (editing) {
    return (
      <div className="post-card">
        <div className="field" style={{ marginBottom: 10 }}>
          <label>제목</label>
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>본문</label>
          <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} style={{ minHeight: 240 }} />
        </div>
        <div className="pc-actions">
          <button className="btn sm primary" onClick={saveEdit} disabled={busy === "edit"}>
            {busy === "edit" ? "저장 중..." : "💾 저장"}
          </button>
          <button className="btn sm" onClick={() => { setEditing(false); setEditTitle(post.title); setEditBody(post.body); }}>취소</button>
        </div>
      </div>
    );
  }

  return (
    <div className="post-card">
      <div className="pc-head">
        <div className="pc-title">{post.title}</div>
        <div className="pc-meta">
          <span className={`badge ${post.channel}`}>{CHANNELS[post.channel as keyof typeof CHANNELS] ?? post.channel}</span>
          {formatLabel && <span>{formatLabel}</span>}
          <span className={`badge ${post.status}`}>{POST_STATUS[post.status as keyof typeof POST_STATUS] ?? post.status}</span>
          <span>{post.body.length}자</span>
          <span>#{post.id}</span>
        </div>
      </div>
      <div className={`pc-body ${expanded ? "expanded" : ""}`} onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        {post.body}
      </div>
      {tags.length > 0 && <div className="pc-tags">{tags.map((t) => `#${t}`).join(" ")}</div>}
      {post.image_suggestion && <div className="pc-image">📷 사진 가이드: {post.image_suggestion}</div>}
      {post.image_prompt && (
        <div className="pc-image" style={{ display: "block", marginTop: 8, background: "#eef0ff", color: "#3d49d8" }}>
          🎨 AI 이미지 프롬프트 (이미지 생성 AI에 붙여넣기):
          <div style={{ whiteSpace: "pre-wrap", marginTop: 4, fontFamily: "monospace", fontSize: 12 }}>{post.image_prompt}</div>
          <button className="btn sm" style={{ marginTop: 6 }} onClick={async () => {
            await navigator.clipboard.writeText(post.image_prompt!);
            alert("프롬프트가 복사되었습니다. Gemini, ChatGPT 등 이미지 생성 AI에 붙여넣으세요.");
          }}>프롬프트 복사</button>
        </div>
      )}
      <div className="pc-actions">
        <button className="btn sm primary" onClick={copy}>{copied ? "✓ 복사됨" : "📋 복사"}</button>
        <button className="btn sm" onClick={() => setEditing(true)} disabled={!!busy}>✏️ 수정</button>
        {post.status !== "published" && (
          <button className="btn sm" onClick={() => setStatus("published")} disabled={!!busy}>✅ 발행 완료</button>
        )}
        {post.status === "published" && (
          <button className="btn sm" onClick={() => setStatus("draft")} disabled={!!busy}>↩ 초안으로</button>
        )}
        {(post.channel === "cafe" || post.channel === "blog") && (
          <>
            <button className="btn sm" onClick={() => derive("threads")} disabled={!!busy}>
              {busy === "threads" ? "변환 중..." : "🧵 스레드 버전"}
            </button>
            <button className="btn sm" onClick={() => derive("instagram")} disabled={!!busy}>
              {busy === "instagram" ? "변환 중..." : "📸 인스타 버전"}
            </button>
          </>
        )}
        {post.status !== "discarded" ? (
          <button className="btn sm" onClick={() => setStatus("discarded")} disabled={!!busy} style={{ marginLeft: "auto", color: "#bf360c" }}>버리기</button>
        ) : (
          <button className="btn sm" onClick={() => setStatus("draft")} disabled={!!busy} style={{ marginLeft: "auto" }}>복구</button>
        )}
      </div>
    </div>
  );
}

export default function JobDetailClient({ job, posts }: { job: Job; posts: Post[] }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const generate = async () => {
    setGenerating(true);
    setGenMsg(`원고 ${job.daily_count}개 생성 중... (1~2분 걸릴 수 있어요)`);
    try {
      const res = await fetch(`/api/jobs/${job.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: job.daily_count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setGenMsg(`✅ ${data.created}개 생성 완료`);
      router.refresh();
    } catch (e) {
      setGenMsg(`❌ ${e instanceof Error ? e.message : "생성 실패"}`);
    }
    setGenerating(false);
  };

  const visible = posts.filter((p) => {
    if (filter === "all") return p.status !== "discarded";
    if (filter === "discarded") return p.status === "discarded";
    if (filter === "derived") return p.channel === "threads" || p.channel === "instagram";
    return p.status === filter;
  });

  const counts = {
    total: posts.filter((p) => p.status !== "discarded").length,
    draft: posts.filter((p) => p.status === "draft").length,
    published: posts.filter((p) => p.status === "published").length,
  };

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <button className="btn primary" onClick={generate} disabled={generating}>
            {generating ? "⏳ 생성 중..." : `⚡ 오늘 분량 생성 (${job.daily_count}개)`}
          </button>
          {genMsg && <span style={{ fontSize: 13, color: "var(--text-soft)" }}>{genMsg}</span>}
          <div className="spacer" />
          <span style={{ fontSize: 13, color: "var(--text-soft)" }}>
            전체 <b>{counts.total}</b> · 초안 <b>{counts.draft}</b> · 발행 <b>{counts.published}</b>
          </span>
        </div>
        <div className="chips">
          {[
            ["all", "전체"],
            ["draft", "초안"],
            ["published", "발행 완료"],
            ["derived", "파생 (스레드/인스타)"],
            ["discarded", "버린 원고"],
          ].map(([key, label]) => (
            <button key={key} type="button" className={`chip ${filter === key ? "selected" : ""}`} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card"><div className="empty">원고가 없습니다. &quot;오늘 분량 생성&quot;을 눌러 시작하세요.</div></div>
      ) : (
        visible.map((p) => <PostCard key={p.id} post={p} onChanged={() => router.refresh()} />)
      )}
    </>
  );
}
