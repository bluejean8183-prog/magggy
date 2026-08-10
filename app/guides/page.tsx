import { getGuide } from "@/lib/guides";
import GuidesClient from "./client";

export const dynamic = "force-dynamic";

export default function GuidesPage() {
  return (
    <>
      <h1 className="page-title"><span>📐</span>공통 가이드</h1>
      <GuidesClient initialBlog={getGuide("blog")} initialCafe={getGuide("cafe")} />
    </>
  );
}
