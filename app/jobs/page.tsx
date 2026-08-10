import Link from "next/link";
import db, { type Job } from "@/lib/db";
import { CHANNELS, FORMATS } from "@/lib/constants";
import JobRowActions from "./row-actions";

export const dynamic = "force-dynamic";

interface JobWithCounts extends Job {
  total_posts: number;
  published_posts: number;
}

function JobTable({ jobs, emptyText }: { jobs: JobWithCounts[]; emptyText: string }) {
  if (jobs.length === 0) return <div className="empty">{emptyText}</div>;
  return (
    <table className="list">
      <thead>
        <tr>
          <th>#</th><th>채널</th><th>대상</th><th>주제</th><th>글 형태</th>
          <th>총 원고</th><th>발행</th><th>일일량</th><th>등록일</th><th>관리</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => {
          const formatLabels = (JSON.parse(job.formats) as string[])
            .map((k) => FORMATS.find((f) => f.key === k)?.label ?? k)
            .join(", ");
          return (
            <tr key={job.id}>
              <td>{job.id}</td>
              <td><span className={`badge ${job.channel}`}>{CHANNELS[job.channel as keyof typeof CHANNELS] ?? job.channel}</span></td>
              <td><Link href={`/jobs/${job.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>{job.target_name}</Link></td>
              <td>{job.topic}</td>
              <td style={{ maxWidth: 200, fontSize: 12, color: "var(--text-soft)" }}>{formatLabels}</td>
              <td><b>{job.total_posts}</b>개</td>
              <td>{job.published_posts}개</td>
              <td>{job.daily_count}개</td>
              <td style={{ whiteSpace: "nowrap" }}>{job.created_at.slice(0, 10)}</td>
              <td><JobRowActions jobId={job.id} status={job.status} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function JobsPage() {
  const jobs = db
    .prepare(
      `SELECT j.*,
        (SELECT COUNT(*) FROM posts p WHERE p.job_id = j.id AND p.channel IN ('cafe','blog')) AS total_posts,
        (SELECT COUNT(*) FROM posts p WHERE p.job_id = j.id AND p.status = 'published') AS published_posts
       FROM jobs j ORDER BY j.id DESC`
    )
    .all() as JobWithCounts[];

  const active = jobs.filter((j) => j.status === "active");
  const done = jobs.filter((j) => j.status === "done");

  return (
    <>
      <h1 className="page-title"><span>📋</span>작업 현황</h1>

      <div className="card">
        <div className="toolbar">
          <b style={{ fontSize: 14 }}>등록된 작업 목록</b>
          <div className="spacer" />
          <Link href="/jobs/new" className="btn sm primary">＋ 작업 추가</Link>
        </div>

        <div className="section-label">작업중 <span className="count">({active.length}건)</span></div>
        <JobTable jobs={active} emptyText="진행 중인 작업이 없습니다." />

        <div className="section-label">작업완료 <span className="count">({done.length}건)</span></div>
        <JobTable jobs={done} emptyText="완료된 작업이 없습니다." />
      </div>
    </>
  );
}
