import { notFound, redirect } from "next/navigation";

import { getScheduleCanvasAction } from "@/actions/schedule/canvas";
import { getWorkloadStatsAction } from "@/actions/schedule/workload";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleCanvas } from "@/components/schedule/canvas/schedule-canvas";
import {
  canPublishSchedule,
  canShareSchedule,
  requireScheduleReadAccess,
} from "@/lib/auth/schedule-access";
import { prisma } from "@/lib/prisma";
import { ensurePlanningCycles } from "@/lib/scheduling/ensure-planning-cycles";
import { findLatestEditingCycleId } from "@/lib/scheduling/load-canvas-draft";
import { loadShareLinksForCycle } from "@/lib/scheduling/load-share-links";

/** หน้า canvas จัดเวรตามรอบ */
export default async function ScheduleCanvasPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const ctx = await requireScheduleReadAccess();
  const { cycleId } = await params;

  let result = await getScheduleCanvasAction(cycleId);

  if (!result.ok) {
    await ensurePlanningCycles(prisma, { organizationId: ctx.organizationId });
    result = await getScheduleCanvasAction(cycleId);
  }

  if (!result.ok) {
    const fallbackCycleId = await findLatestEditingCycleId(prisma, ctx.organizationId);
    if (fallbackCycleId && fallbackCycleId !== cycleId) {
      redirect(`/schedule/${fallbackCycleId}`);
    }

    notFound();
  }

  const payload = result.data;
  const workloadResult = await getWorkloadStatsAction();
  const initialWorkloadSnapshot = workloadResult.ok ? workloadResult.data.snapshot : null;

  const publishedVersion = await prisma.scheduleVersion.findFirst({
    where: {
      organizationId: ctx.organizationId,
      scheduleCycleId: cycleId,
      status: { in: ["PUBLISHED", "LOCKED"] },
    },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true },
  });

  const canPublish = canPublishSchedule(ctx);
  const canShare = canShareSchedule(ctx);
  const initialShareLinks =
    canShare ? await loadShareLinksForCycle(ctx.organizationId, cycleId) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`จัดเวร — ${payload.cycleName}`}
        description={`${payload.periodStart} ถึง ${payload.periodEnd} · draft v${payload.optimisticVersion}`}
      />
      <ScheduleCanvas
        initial={payload}
        initialWorkloadSnapshot={initialWorkloadSnapshot}
        publishShare={
          canPublish || canShare
            ? {
              canPublish,
              canShare,
              publishedVersionId: publishedVersion?.id ?? null,
              publishedVersionNumber: publishedVersion?.versionNumber ?? null,
              initialShareLinks,
            }
            : null
        }
      />
    </div>
  );
}
