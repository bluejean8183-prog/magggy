"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const items = [
    { href: "/jobs/new", label: "＋ 작업 추가" },
    { href: "/jobs", label: "📋 작업 현황" },
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
    </nav>
  );
}
