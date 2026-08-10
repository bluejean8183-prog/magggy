import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.status && ["draft", "published", "discarded"].includes(body.status)) {
    db.prepare(
      `UPDATE posts SET status = ?, published_at = CASE WHEN ? = 'published' THEN datetime('now', 'localtime') ELSE published_at END WHERE id = ?`
    ).run(body.status, body.status, id);
  }
  return NextResponse.json({ ok: true });
}
