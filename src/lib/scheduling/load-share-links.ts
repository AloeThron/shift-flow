import { isShareLinkActive } from "@/domain/schedule/share/token";
import { prisma } from "@/lib/prisma";

/** มุมมองลิงก์แชร์ — ไม่มี token */
export type ShareLinkView = {
  readonly id: string;
  readonly scheduleVersionId: string;
  readonly versionNumber: number;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly createdAt: string;
  readonly viewCount: number;
  readonly isActive: boolean;
};

/** โหลดลิงก์แชร์ของรอบตาราง */
export async function loadShareLinksForCycle(
  organizationId: string,
  cycleId: string,
): Promise<ShareLinkView[]> {
  const now = new Date();
  const versions = await prisma.scheduleVersion.findMany({
    where: {
      organizationId,
      scheduleCycleId: cycleId,
      status: { in: ["PUBLISHED", "LOCKED", "SUPERSEDED"] },
    },
    select: { id: true },
  });

  if (versions.length === 0) {
    return [];
  }

  const rows = await prisma.scheduleShareLink.findMany({
    where: {
      organizationId,
      scheduleVersionId: { in: versions.map((version) => version.id) },
    },
    orderBy: { createdAt: "desc" },
    include: {
      scheduleVersion: { select: { versionNumber: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    scheduleVersionId: row.scheduleVersionId,
    versionNumber: row.scheduleVersion.versionNumber,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    viewCount: row.viewCount,
    isActive: isShareLinkActive(row, now),
  }));
}
