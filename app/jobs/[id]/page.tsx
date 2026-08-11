import { notFound } from "next/navigation";
import db, { type Job, type Pattern, type Post } from "@/lib/db";
import { CHANNELS, FORMATS } from "@/lib/constants";
import JobDetailClient from "./client";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = (await db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id)) as Job | undefined;
  if (!job) notFound();

  const posts = (await db
    .prepare(`SELECT * FROM posts WHERE job_id = ? ORDER BY id DESC`)
    .all(id)) as Post[];

  const formatLabels = (JSON.parse(job.formats) as string[])
    .map((k) => FORMATS.find((f) => f.key === k)?.label ?? k)
    .join(" · ");

  const pattern = job.pattern_id
    ? ((await db.prepare(`SELECT * FROM patterns WHERE id = ?`).get(job.pattern_id)) as Pattern | undefined)
    : undefined;

  return (
    <>
      <h1 className="page-title">
        <span>📝</span>
        {job.target_name}
        <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-soft)", marginLeft: 12 }}>
          {CHANNELS[job.channel as keyof typeof CHANNELS]} · {job.topic} · {formatLabels} · 일 {job.daily_count}개
          {pattern && <> · 🔑 패턴: {pattern.keyword}</>}
        </span>
      </h1>
      <JobDetailClient job={JSON.parse(JSON.stringify(job))} posts={JSON.parse(JSON.stringify(posts))} />
    </>
  );
}
