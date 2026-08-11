import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.status && ["draft", "published", "discarded"].includes(body.status)) {
    await db.prepare(
      `UPDATE posts SET status = ?, published_at = CASE WHEN ? = 'published' THEN datetime('now', 'localtime') ELSE published_at END WHERE id = ?`
    ).run(body.status, body.status, id);
  }

  if (typeof body.title === "string" && typeof body.body === "string") {
    if (!body.title.trim() || !body.body.trim()) {
      return NextResponse.json({ error: "제목과 본문은 비울 수 없습니다." }, { status: 400 });
    }
    await db.prepare(`UPDATE posts SET title = ?, body = ? WHERE id = ?`).run(body.title.trim(), body.body.trim(), id);
  }

  return NextResponse.json({ ok: true });
}
