"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ engineLabel }: { engineLabel: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/jobs/new", label: "＋ 작업 추가" },
    { href: "/jobs", label: "📋 작업 현황" },
    { href: "/patterns", label: "🔍 패턴 분석" },
  ];
  return (
    <nav className="sidebar">
      <div className="logo">magggy</div>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
        >
          {item.label}
        </Link>
      ))}
      <div className="engine-badge">
        <div className="eb-label">생성 엔진</div>
        <div className="eb-value">{engineLabel}</div>
      </div>
    </nav>
  );
}
