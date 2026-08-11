import type { PrismaClient } from "@/generated/client/client";

type DraftDbClient = Pick<PrismaClient, "scheduleDraft">;

/** ตรวจ optimistic version ก่อน commit */
export async function assertOptimisticVersion(
  db: DraftDbClient,
  draftId: string,
  optimisticVersion: number,
  organizationId: string,
): Promise<void> {
  const draft = await db.scheduleDraft.findFirst({
    where: { id: draftId, organizationId },
    select: { optimisticVersion: true },
  });

  if (!draft) {
    throw new Error("ไม่พบ draft");
  }

  if (draft.optimisticVersion !== optimisticVersion) {
    throw new Error("ตารางถูกแก้จากที่อื่นแล้ว — โหลดใหม่ก่อนบันทึก");
  }
}

/** เพิ่ม optimistic version หลัง commit */
export async function bumpOptimisticVersion(
  db: DraftDbClient,
  draftId: string,
  organizationId: string,
): Promise<number> {
  const updated = await db.scheduleDraft.update({
    where: { id: draftId, organizationId },
    data: { optimisticVersion: { increment: 1 } },
    select: { optimisticVersion: true },
  });
  return updated.optimisticVersion;
}
