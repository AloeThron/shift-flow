#!/usr/bin/env tsx
import { config } from "dotenv";

config({ path: ".env.local" });
config();

/** CLI — สรุปข้อมูลเก่ากว่าหน้าต่างเป็น StaffWorkloadMonthly */
async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/prisma");
  const { archiveHistoryWindowForAllOrganizations } =
    await import("../src/lib/scheduling/archive-history-window");

  const asOfDate = process.argv.find((arg) => arg.startsWith("--as-of="))?.split("=")[1];
  const deleteDetailedData = process.argv.includes("--delete-detailed-data");

  const results = await archiveHistoryWindowForAllOrganizations(prisma, {
    asOfDate,
    deleteDetailedData,
  });

  for (const result of results) {
    if (result.archivedMonths.length === 0) {
      continue;
    }

    console.info(
      `org=${result.policy.organizationId} windowStart=${result.windowStart} months=${result.archivedMonths.join(",")} upserted=${result.upsertedRows} deleted=${result.deletedAssignmentIds.length}`,
    );
  }

  const totalUpserted = results.reduce((sum, result) => sum + result.upsertedRows, 0);
  console.info(`archive complete: organizations=${results.length} upserted=${totalUpserted}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
