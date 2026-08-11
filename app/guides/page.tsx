import { getGuide } from "@/lib/guides";
import GuidesClient from "./client";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [initialBlog, initialCafe] = await Promise.all([getGuide("blog"), getGuide("cafe")]);
  return (
    <>
      <h1 className="page-title"><span>📐</span>공통 가이드</h1>
      <GuidesClient initialBlog={initialBlog} initialCafe={initialCafe} />
    </>
  );
}
