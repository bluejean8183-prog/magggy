import { NextRequest, NextResponse } from "next/server";
import { getGuide, setGuide, DEFAULT_BLOG_GUIDE, DEFAULT_CAFE_GUIDE } from "@/lib/guides";

export async function GET() {
  const [blog, cafe] = await Promise.all([getGuide("blog"), getGuide("cafe")]);
  return NextResponse.json({
    blog,
    cafe,
    defaults: { blog: DEFAULT_BLOG_GUIDE, cafe: DEFAULT_CAFE_GUIDE },
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (typeof body.blog === "string" && body.blog.trim()) await setGuide("blog", body.blog.trim());
  if (typeof body.cafe === "string" && body.cafe.trim()) await setGuide("cafe", body.cafe.trim());
  return NextResponse.json({ ok: true });
}
