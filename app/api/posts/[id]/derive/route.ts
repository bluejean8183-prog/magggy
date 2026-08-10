import { NextRequest, NextResponse } from "next/server";
import db, { type Post } from "@/lib/db";
import { derivePost } from "@/lib/claude";

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id) as Post | undefined;
  if (!post) return NextResponse.json({ error: "원고를 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const channel = body.channel as "threads" | "instagram";
  if (!["threads", "instagram"].includes(channel)) {
    return NextResponse.json({ error: "채널은 threads 또는 instagram이어야 합니다." }, { status: 400 });
  }

  try {
    const derived = await derivePost(post, channel);
    const result = db
      .prepare(
        `INSERT INTO posts (job_id, parent_id, channel, format, title, body, tags, image_suggestion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(post.job_id, post.id, channel, null, derived.title, derived.body, JSON.stringify(derived.tags), derived.image_suggestion);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "변환 실패" }, { status: 500 });
  }
}
