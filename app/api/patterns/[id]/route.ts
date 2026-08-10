import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare(`UPDATE jobs SET pattern_id = NULL WHERE pattern_id = ?`).run(id);
  db.prepare(`DELETE FROM patterns WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
