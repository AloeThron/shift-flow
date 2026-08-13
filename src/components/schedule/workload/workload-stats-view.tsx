import { ExportWorkloadButton } from "@/components/schedule/workload/export-workload-button";
import { GroupWorkloadSummary } from "@/components/schedule/workload/group-workload-summary";
import { StaffWorkloadTable } from "@/components/schedule/workload/staff-workload-table";
import { FAIRNESS_DIMENSION_LABELS } from "@/components/schedule/workload/workload-labels";
import type { WorkloadStatsSnapshot } from "@/domain/optimize/fairness/workload-stats";

/** หน้ามุมมอง workload เต็ม */
export function WorkloadStatsView({
  snapshot,
  canExport,
}: {
  snapshot: WorkloadStatsSnapshot;
  canExport: boolean;
}) {
  const cycleLabel = snapshot.currentCycle
    ? `${snapshot.currentCycle.cycleName} (${snapshot.currentCycle.periodStart} – ${snapshot.currentCycle.periodEnd})`
    : undefined;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">สรุปต่อกลุ่ม</h2>
            <p className="text-muted-foreground text-sm">
              ย้อนหลัง {snapshot.fairnessLookbackMonths.length} เดือน · มิติ fairness:{" "}
              {FAIRNESS_DIMENSION_LABELS[snapshot.fairDimension]}
              {snapshot.maxOtHoursPerStaff !== undefined
                ? ` · เพดาน OT ${snapshot.maxOtHoursPerStaff} ชม./รอบ`
                : ""}
            </p>
          </div>
          {canExport ? <ExportWorkloadButton /> : null}
        </div>
        <GroupWorkloadSummary
          groups={snapshot.groupStats}
          fairDimension={snapshot.fairDimension}
          toleranceHours={snapshot.toleranceHours}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">รายคน</h2>
          <p className="text-muted-foreground text-sm">
            ใช้สูตรเดียวกับ solver carry-over — offset สูง = เริ่มขั้นบันไดต้นทุนแพงกว่า
            {cycleLabel ? ` · รอบปัจจุบัน: ${cycleLabel}` : ""}
          </p>
        </div>
        <StaffWorkloadTable
          trends={snapshot.staffTrends}
          lookbackMonths={snapshot.fairnessLookbackMonths}
          currentCycleLabel={snapshot.currentCycle?.cycleName}
        />
      </section>

      <p className="text-muted-foreground text-xs">
        วัตถุประสงค์: ความเป็นธรรมของการจัดเวร — ไม่ใช่การประเมินผลงาน · ข้อมูล ณ {snapshot.asOfDate}
      </p>
    </div>
  );
}
