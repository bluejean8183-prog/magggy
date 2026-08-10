"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JobRowActions({ jobId, status }: { jobId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "active" ? "done" : "active" }),
    });
    router.refresh();
    setBusy(false);
  };

  return (
    <button className="btn sm" onClick={toggle} disabled={busy}>
      {status === "active" ? "완료 처리" : "다시 진행"}
    </button>
  );
}
