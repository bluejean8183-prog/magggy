import { NextRequest, NextResponse } from "next/server";
import db, { batch, type Job, type Pattern } from "@/lib/db";
import { generateBatch } from "@/lib/claude";
import { getGuide } from "@/lib/guides";

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = (await db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id)) as Job | undefined;
  if (!job) return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Number(body.count) || job.daily_count, 20);

  const pattern = job.pattern_id
    ? ((await db.prepare(`SELECT * FROM patterns WHERE id = ?`).get(job.pattern_id)) as Pattern | undefined)
    : undefined;

  try {
    const posts = await generateBatch(job, count, pattern?.guide, await getGuide(job.channel));
    const sql = `INSERT INTO posts (job_id, channel, format, title, body, tags, image_suggestion, image_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    await batch(
      posts.map((p) => ({
        sql,
        args: [job.id, job.channel, p.format, p.title, p.body, JSON.stringify(p.tags), p.image_suggestion, p.image_prompt],
      }))
    );
    return NextResponse.json({ created: posts.length, requested: count });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "생성 실패" }, { status: 500 });
  }
}
