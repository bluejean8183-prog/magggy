import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "magggy.db"));
db.pragma("journal_mode = WAL");

db.exec(`
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

// 기존 DB에 새 컬럼 추가 (이미 있으면 무시)
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN pattern_id INTEGER REFERENCES patterns(id)`);
} catch {
  /* column already exists */
}

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
  status: string;
  created_at: string;
  published_at: string | null;
}

export default db;
