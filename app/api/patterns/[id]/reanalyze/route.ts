import { NextRequest, NextResponse } from "next/server";
import db, { type Pattern } from "@/lib/db";
import { analyzePattern } from "@/lib/claude";

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pattern = (await db.prepare(`SELECT * FROM patterns WHERE id = ?`).get(id)) as Pattern | undefined;
  if (!pattern) return NextResponse.json({ error: "패턴을 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json();
  const samples = String(body.samples ?? "").trim();
  if (samples.length < 200) {
    return NextResponse.json({ error: "최신 상위 노출 글을 2개 이상 붙여넣어 주세요." }, { status: 400 });
  }

  try {
    const { summary, guide } = await analyzePattern(pattern.keyword, samples);
    await db.prepare(
      `UPDATE patterns SET summary = ?, guide = ?, created_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(summary, guide, id);
    return NextResponse.json({ id: pattern.id, keyword: pattern.keyword, summary, guide });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "재분석 실패" }, { status: 500 });
  }
}
