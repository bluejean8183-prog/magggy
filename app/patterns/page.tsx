import db, { type Pattern } from "@/lib/db";
import PatternsClient from "./client";

export const dynamic = "force-dynamic";

export default function PatternsPage() {
  const patterns = db.prepare(`SELECT * FROM patterns ORDER BY id DESC`).all() as Pattern[];
  return (
    <>
      <h1 className="page-title"><span>🔍</span>패턴 분석</h1>
      <PatternsClient initialPatterns={JSON.parse(JSON.stringify(patterns))} />
    </>
  );
}
