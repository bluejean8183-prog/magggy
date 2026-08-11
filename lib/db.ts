import { createClient, type InArgs, type Client } from "@libsql/client";

// ── Turso(libSQL) 연결 ──────────────────────────────────────────────
// 클라우드: TURSO_DATABASE_URL(libsql://...) + TURSO_AUTH_TOKEN
// 로컬 개발: 환경변수 없으면 file:data/magggy.db 로컬 SQLite 파일 사용
const url = process.env.TURSO_DATABASE_URL || "file:data/magggy.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client: Client = createClient(
  url.startsWith("file:") ? { url } : { url, authToken }
);

// undefined 인자는 null로 (libSQL은 undefined를 거부)
function toArgs(args: unknown[]): InArgs {
  return args.map((v) => (v === undefined ? null : v)) as InArgs;
}

// libSQL Row(배열형)를 컬럼명 기반 순수 객체로 — 타입 캐스팅/JSON 직렬화 안전
function rowsToObjects(columns: string[], rows: unknown[][]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c, i) => {
      o[c] = (r as unknown[])[i];
    });
    return o;
  });
}

// ── 스키마 초기화 (최초 1회, idempotent) ─────────────────────────────
let initialized: Promise<void> | null = null;

async function init(): Promise<void> {
  await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_url TEXT,
  topic TEXT NOT NULL,
  formats TEXT NOT NULL,
  daily_count INTEGER NOT NULL,
  min_chars INTEGER NOT NULL,
  max_chars INTEGER NOT NULL,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  summary TEXT NOT NULL,
  guide TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  parent_id INTEGER REFERENCES posts(id),
  channel TEXT NOT NULL,
  format TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  image_suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  published_at TEXT
);
`);

  // 기존 DB에 새 컬럼 추가 (이미 있으면 무시) — 각각 개별 실행(executeMultiple은 첫 에러에서 중단)
  const alters = [
    `ALTER TABLE jobs ADD COLUMN pattern_id INTEGER REFERENCES patterns(id)`,
    `ALTER TABLE jobs ADD COLUMN image_mode TEXT NOT NULL DEFAULT 'real'`,
    `ALTER TABLE posts ADD COLUMN image_prompt TEXT`,
  ];
  for (const sql of alters) {
    try {
      await client.execute(sql);
    } catch {
      /* column already exists */
    }
  }
}

function ready(): Promise<void> {
  if (!initialized) initialized = init();
  return initialized;
}

// ── better-sqlite3 호환 어댑터 (동기 → 비동기) ───────────────────────
// db.prepare(sql).get/all/run(...args) 형태 유지 → 호출부는 await만 추가
function prepare(sql: string) {
  return {
    async all<T = Record<string, unknown>>(...args: unknown[]): Promise<T[]> {
      await ready();
      const rs = await client.execute({ sql, args: toArgs(args) });
      return rowsToObjects(rs.columns, rs.rows as unknown as unknown[][]) as T[];
    },
    async get<T = Record<string, unknown>>(...args: unknown[]): Promise<T | undefined> {
      const rows = await this.all<T>(...args);
      return rows[0];
    },
    async run(...args: unknown[]): Promise<{ lastInsertRowid: number; changes: number }> {
      await ready();
      const rs = await client.execute({ sql, args: toArgs(args) });
      return {
        lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : 0,
        changes: Number(rs.rowsAffected),
      };
    },
  };
}

// 여러 INSERT 등을 원자적으로 (better-sqlite3의 db.transaction 대체)
export async function batch(stmts: { sql: string; args?: unknown[] }[]): Promise<void> {
  await ready();
  await client.batch(
    stmts.map((s) => ({ sql: s.sql, args: toArgs(s.args ?? []) })),
    "write"
  );
}

const db = { prepare };
export default db;

export interface Job {
  id: number;
  channel: string;
  target_name: string;
  target_url: string | null;
  topic: string;
  formats: string;
  daily_count: number;
  min_chars: number;
  max_chars: number;
  memo: string | null;
  status: string;
  pattern_id: number | null;
  image_mode: string;
  created_at: string;
}

export interface Pattern {
  id: number;
  keyword: string;
  summary: string;
  guide: string;
  created_at: string;
}

export interface Post {
  id: number;
  job_id: number;
  parent_id: number | null;
  channel: string;
  format: string | null;
  title: string;
  body: string;
  tags: string;
  image_suggestion: string | null;
  image_prompt: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
}
