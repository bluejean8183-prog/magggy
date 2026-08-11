import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (body.status && ["active", "done"].includes(body.status)) {
    await db.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).run(body.status, id);
  }
  return NextResponse.json({ ok: true });
}
