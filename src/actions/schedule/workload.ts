"use server";

import type { ActionResult } from "@/domain/action-result";
import type { WorkloadStatsSnapshot } from "@/domain/optimize/fairness/workload-stats";
import { formatWorkloadStatsCsv } from "@/domain/optimize/fairness/workload-stats";
import { actionErrorMessage } from "@/lib/auth/get-organization-context";
import { requireScheduleReadAccess } from "@/lib/auth/schedule-access";
import { canExportWorkloadStats } from "@/lib/auth/workload-access";
import { prisma } from "@/lib/prisma";
import { loadWorkloadStatsSnapshot } from "@/lib/scheduling/load-workload-stats";

/** โหลด snapshot workload สำหรับหน้า stats และ canvas sidebar */
export async function getWorkloadStatsAction(): Promise<
  ActionResult<{
    snapshot: WorkloadStatsSnapshot;
    canExport: boolean;
  }>
> {
  try {
    const ctx = await requireScheduleReadAccess();

    const snapshot = await loadWorkloadStatsSnapshot(prisma, {
      organizationId: ctx.organizationId,
    });

    return {
      ok: true,
      data: {
        snapshot,
        canExport: canExportWorkloadStats(ctx),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** ส่งออก CSV workload — ตาม RBAC */
export async function exportWorkloadStatsCsvAction(): Promise<
  ActionResult<{ csv: string; filename: string }>
> {
  try {
    const ctx = await requireScheduleReadAccess();
    if (!canExportWorkloadStats(ctx)) {
      return { ok: false, error: "ไม่มีสิทธิ์ส่งออกข้อมูล workload" };
    }

    const snapshot = await loadWorkloadStatsSnapshot(prisma, {
      organizationId: ctx.organizationId,
    });
    const csv = formatWorkloadStatsCsv(snapshot);
    const filename = `workload-stats-${snapshot.asOfDate}.csv`;

    return { ok: true, data: { csv, filename } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
