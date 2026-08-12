"use client";

import { useState } from "react";

import { exportStudySetAction } from "@/app/sets/[setId]/actions";

export function ExportStudySetButton({ studySetId }: { studySetId: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function exportItems() {
    setStatus("Preparing export...");
    const result = await exportStudySetAction(studySetId);
    if (!result.ok || !result.json) {
      setStatus(result.message ?? "Export failed.");
      return;
    }

    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${studySetId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("JSON exported.");
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button type="button" onClick={exportItems} className="min-h-11 rounded-xl border border-[#b9cfca] px-4 py-2 text-sm font-semibold text-[#24564e] transition hover:bg-[#e8f1ee] active:translate-y-px dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]">
        Export JSON
      </button>
      {status && <p className="text-xs text-[#66807a] dark:text-[#94aea7]" role="status">{status}</p>}
    </div>
  );
}
