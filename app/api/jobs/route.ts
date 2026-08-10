import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channel, target_name, target_url, topic, formats, daily_count, min_chars, max_chars, memo, pattern_id } = body;

  if (!channel || !target_name || !topic || !Array.isArray(formats) || formats.length === 0) {
    return NextResponse.json({ error: "필수 항목이 비어있습니다." }, { status: 400 });
  }

  const result = db
    .prepare(
      `INSERT INTO jobs (channel, target_name, target_url, topic, formats, daily_count, min_chars, max_chars, memo, pattern_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      channel,
      target_name,
      target_url || null,
      topic,
      JSON.stringify(formats),
      daily_count || 5,
      min_chars || 300,
      max_chars || 800,
      memo || null,
      pattern_id ? Number(pattern_id) : null
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}
