// 로컬 SQLite(data/magggy.db) → 원격 Turso(libSQL)로 데이터 이전.
// 사용: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate-to-turso.mjs
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("❌ TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

const local = createClient({ url: "file:data/magggy.db" });
const remote = createClient({ url, authToken });

// 앱과 동일한 스키마 (lib/db.ts init과 일치)
const DDL = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, target_name TEXT NOT NULL,
  target_url TEXT, topic TEXT NOT NULL, formats TEXT NOT NULL, daily_count INTEGER NOT NULL,
  min_chars INTEGER NOT NULL, max_chars INTEGER NOT NULL, memo TEXT,
  status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL, summary TEXT NOT NULL,
  guide TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL REFERENCES jobs(id),
  parent_id INTEGER REFERENCES posts(id), channel TEXT NOT NULL, format TEXT, title TEXT NOT NULL,
  body TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', image_suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  published_at TEXT
);
`;

async function main() {
  console.log("원격 스키마 생성 중...");
  await remote.executeMultiple(DDL);
  for (const sql of [
    "ALTER TABLE jobs ADD COLUMN pattern_id INTEGER REFERENCES patterns(id)",
    "ALTER TABLE jobs ADD COLUMN image_mode TEXT NOT NULL DEFAULT 'real'",
    "ALTER TABLE posts ADD COLUMN image_prompt TEXT",
  ]) {
    try { await remote.execute(sql); } catch { /* 이미 있음 */ }
  }

  // 순서 중요: jobs → patterns → posts(외래키) / settings 독립
  for (const table of ["jobs", "patterns", "posts", "settings"]) {
    const { columns, rows } = await local.execute(`SELECT * FROM ${table}`);
    if (rows.length === 0) { console.log(`- ${table}: 0건 (건너뜀)`); continue; }
    const placeholders = columns.map(() => "?").join(", ");
    const colList = columns.join(", ");
    const stmts = rows.map((r) => ({
      sql: `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`,
      args: columns.map((c) => r[c]),
    }));
    await remote.batch(stmts, "write");
    console.log(`- ${table}: ${rows.length}건 이전 완료`);
  }

  // 검증
  console.log("\n=== 원격 DB 검증 ===");
  for (const table of ["jobs", "patterns", "posts", "settings"]) {
    const rs = await remote.execute(`SELECT COUNT(*) AS c FROM ${table}`);
    console.log(`- ${table}: ${rs.rows[0].c}건`);
  }
  console.log("\n✅ 이전 완료");
}

main().catch((e) => { console.error("❌ 실패:", e); process.exit(1); });
