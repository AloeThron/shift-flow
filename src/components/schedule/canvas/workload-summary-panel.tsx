import Link from "next/link";

import type { WorkloadStatsSnapshot } from "@/domain/optimize/fairness/workload-stats";

import {
  FAIRNESS_DIMENSION_LABELS,
  formatWorkloadNumber,
  WORKLOAD_METRIC_LABELS,
} from "@/components/schedule/workload/workload-labels";

/** นับคนที่เกิน tolerance รวมทุกกลุ่ม */
export function countOutOfToleranceStaff(snapshot: WorkloadStatsSnapshot): number {
  return snapshot.groupStats.reduce((total, group) => total + group.outOfTolerance.length, 0);
}

/** เนื้อหา section ภาระงาน & fairness — ไม่มี Card wrapper */
export function WorkloadSummarySection({
  snapshot,
  achieved = false,
  showViewAllLink = true,
}: {
  snapshot: WorkloadStatsSnapshot;
  achieved?: boolean;
  showViewAllLink?: boolean;
}) {
  const outOfToleranceCount = countOutOfToleranceStaff(snapshot);

  if (achieved && outOfToleranceCount === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        fairness อยู่ใน tolerance (±{snapshot.toleranceHours} ชม.)
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">
        {FAIRNESS_DIMENSION_LABELS[snapshot.fairDimension]} · tolerance ±{snapshot.toleranceHours}{" "}
        ชม.
      </p>

      {snapshot.groupStats.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีข้อมูลกลุ่ม</p>
      ) : (
        <ul className="space-y-2">
          {snapshot.groupStats.map((group) => (
            <li key={group.groupKey} className="rounded-md border px-2 py-2">
              <p className="font-medium">{group.groupName}</p>
              <p className="text-muted-foreground mt-1">
                {WORKLOAD_METRIC_LABELS.plannedHours}: spread{" "}
                {formatWorkloadNumber(group.lookbackSpreads.plannedHours.spread)} ·{" "}
                {WORKLOAD_METRIC_LABELS.otHours}: spread{" "}
                {formatWorkloadNumber(group.lookbackSpreads.otHours.spread)}
              </p>
              {group.fairnessReport ? (
                <p className="text-muted-foreground mt-1">
                  fairness spread {formatWorkloadNumber(group.fairnessReport.spread.spread)}
                  {group.outOfTolerance.length > 0
                    ? ` · เกิน tolerance ${group.outOfTolerance.length} คน`
                    : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {snapshot.currentCycle ? (
        <p className="text-muted-foreground border-t pt-2">
          รอบ {snapshot.currentCycle.cycleName} — อัปเดตสดจาก draft
        </p>
      ) : null}

      {showViewAllLink ? (
        <Link href="/schedule/workload" className="text-primary inline-block hover:underline">
          ดูทั้งหมด
        </Link>
      ) : null}
    </div>
  );
}
