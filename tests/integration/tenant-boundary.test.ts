import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";

/** integration — tenant boundary กับ PostgreSQL จริง */
describe("tenant boundary (integration)", () => {
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const departmentAId = randomUUID();
  const departmentBId = randomUUID();

  afterAll(async () => {
    await prisma.department.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prisma.$disconnect();
  });

  it("scoped repository อ่านได้เฉพาะข้อมูลใน organization ของตัวเอง", async () => {
    await prisma.organization.createMany({
      data: [
        {
          id: orgAId,
          name: "Org A Test",
          slug: `test-org-a-${orgAId.slice(0, 8)}`,
          timezone: "Asia/Bangkok",
        },
        {
          id: orgBId,
          name: "Org B Test",
          slug: `test-org-b-${orgBId.slice(0, 8)}`,
          timezone: "Asia/Bangkok",
        },
      ],
    });

    await prisma.department.createMany({
      data: [
        {
          id: departmentAId,
          organizationId: orgAId,
          code: "DEPT-A",
          displayName: "แผนก A",
          sortOrder: 1,
          active: true,
        },
        {
          id: departmentBId,
          organizationId: orgBId,
          code: "DEPT-B",
          displayName: "แผนก B",
          sortOrder: 1,
          active: true,
        },
      ],
    });

    const repoA = createScopedRepository(
      { organizationId: orgAId, userId: "user-a", role: "SCHEDULER" },
      prisma,
    );
    const repoB = createScopedRepository(
      { organizationId: orgBId, userId: "user-b", role: "SCHEDULER" },
      prisma,
    );

    const departmentsA = await repoA.department.findMany();
    const departmentsB = await repoB.department.findMany();

    expect(departmentsA.every((row) => row.organizationId === orgAId)).toBe(true);
    expect(departmentsB.every((row) => row.organizationId === orgBId)).toBe(true);
    expect(departmentsA.some((row) => row.id === departmentBId)).toBe(false);
    expect(departmentsB.some((row) => row.id === departmentAId)).toBe(false);
  });

  it("update ข้าม organization ถูกปฏิเสธ", async () => {
    const repoA = createScopedRepository(
      { organizationId: orgAId, userId: "user-a", role: "SCHEDULER" },
      prisma,
    );

    await expect(
      repoA.department.update({
        id: departmentBId,
        data: { displayName: "แฮก" },
      }),
    ).rejects.toThrow(/ไม่พบข้อมูลในองค์กร/);
  });

  it("composite unique แยก organization ได้", async () => {
    const repoA = createScopedRepository(
      { organizationId: orgAId, userId: "user-a", role: "SCHEDULER" },
      prisma,
    );
    const repoB = createScopedRepository(
      { organizationId: orgBId, userId: "user-b", role: "SCHEDULER" },
      prisma,
    );

    await repoA.department.create({
      code: "SHARED",
      displayName: "Shared A",
      sortOrder: 99,
      active: true,
    });

    await expect(
      repoB.department.create({
        code: "SHARED",
        displayName: "Shared B",
        sortOrder: 99,
        active: true,
      }),
    ).resolves.toBeDefined();
  });
});
