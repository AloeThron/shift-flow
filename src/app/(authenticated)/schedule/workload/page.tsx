import { getWorkloadStatsAction } from "@/actions/schedule/workload";
import { PageHeader } from "@/components/layout/page-header";
import { WorkloadStatsView } from "@/components/schedule/workload/workload-stats-view";
import { requireScheduleReadAccess } from "@/lib/auth/schedule-access";

/** หน้าสถิติ workload — 6 เดือนย้อนหลัง + รอบปัจจุบัน */
export default async function ScheduleWorkloadPage() {
  await requireScheduleReadAccess();
  const result = await getWorkloadStatsAction();

  const snapshot = result.ok ? result.data.snapshot : null;
  const canExport = result.ok ? result.data.canExport : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="สถิติภาระงาน"
        description={
          snapshot
            ? `ย้อนหลัง ${snapshot.fairnessLookbackMonths.length} เดือน · ใช้สูตรเดียวกับ solver carry-over`
            : result.ok
              ? "ยังไม่มีข้อมูล workload"
              : result.error
        }
      />

      {snapshot ? <WorkloadStatsView snapshot={snapshot} canExport={canExport} /> : null}
    </div>
  );
}
