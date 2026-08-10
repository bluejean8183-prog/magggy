import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./sidebar";
import { resolveEngine, ENGINE_LABELS } from "@/lib/engine";

export const metadata: Metadata = {
  title: "magggy — 마케팅 육성 스튜디오",
  description: "네이버 블로그/카페 육성 원고 생산 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const engineLabel = ENGINE_LABELS[resolveEngine()];
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <Sidebar engineLabel={engineLabel} />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
