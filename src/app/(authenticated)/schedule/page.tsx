import { redirect } from "next/navigation";

import { requireScheduleReadAccess } from "@/lib/auth/schedule-access";
import { prisma } from "@/lib/prisma";
import { ensurePlanningCycles } from "@/lib/scheduling/ensure-planning-cycles";

/** หน้า schedule root — redirect ไป canvas รอบที่แก้ได้ */
export default async function ScheduleIndexPage() {
  const ctx = await requireScheduleReadAccess();

  await ensurePlanningCycles(prisma, { organizationId: ctx.organizationId });

  const draft = await prisma.scheduleDraft.findFirst({
    where: {
      organizationId: ctx.organizationId,
      status: "EDITING",
    },
    orderBy: { updatedAt: "desc" },
    select: { scheduleCycleId: true },
  });

  if (!draft) {
    redirect("/schedule/workload");
  }

  redirect(`/schedule/${draft.scheduleCycleId}`);
}
