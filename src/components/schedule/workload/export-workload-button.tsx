"use client";

import { useTransition } from "react";

import { exportWorkloadStatsCsvAction } from "@/actions/schedule/workload";
import { Button } from "@/components/ui/button";

/** ปุ่มส่งออก CSV workload */
export function ExportWorkloadButton() {
  const [pending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportWorkloadStatsCsvAction();
      if (!result.ok) {
        window.alert(result.error);
        return;
      }

      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleExport}>
      {pending ? "กำลังส่งออก…" : "ส่งออก CSV"}
    </Button>
  );
}
