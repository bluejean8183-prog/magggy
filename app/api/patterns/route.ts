import { NextRequest, NextResponse } from "next/server";
import db, { type Pattern } from "@/lib/db";
import { analyzePattern } from "@/lib/claude";

export const maxDuration = 300;

export async function GET() {
  const patterns = (await db.prepare(`SELECT * FROM patterns ORDER BY id DESC`).all()) as Pattern[];
  return NextResponse.json(patterns);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const keyword = String(body.keyword ?? "").trim();
  const samples = String(body.samples ?? "").trim();

  if (!keyword) return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });
  if (samples.length < 200) {
    return NextResponse.json({ error: "상위 노출 글을 2개 이상 붙여넣어 주세요 (내용이 너무 짧습니다)." }, { status: 400 });
  }

  try {
    const { summary, guide } = await analyzePattern(keyword, samples);
    const result = await db
      .prepare(`INSERT INTO patterns (keyword, summary, guide) VALUES (?, ?, ?)`)
      .run(keyword, summary, guide);
    return NextResponse.json({ id: result.lastInsertRowid, keyword, summary, guide });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "분석 실패" }, { status: 500 });
  }
}
