import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildAssignmentInterval } from "@/domain/schedule/time";
import type { ScheduleEngineInput } from "@/domain/schedule/types";

const mocks = vi.hoisted(() => ({
  requireSchedulePublishAccess: vi.fn(),
  loadCanvasDraftSnapshot: vi.fn(),
  recordAuditEvent: vi.fn(),
  createScopedRepository: vi.fn(),
  scheduleVersionFindFirst: vi.fn(),
  assignmentFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/get-organization-context", () => ({
  actionErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "unexpected error",
}));

vi.mock("@/lib/auth/schedule-access", () => ({
  requireSchedulePublishAccess: mocks.requireSchedulePublishAccess,
}));

vi.mock("@/lib/scheduling/load-canvas-draft", () => ({
  loadCanvasDraftSnapshot: mocks.loadCanvasDraftSnapshot,
}));

vi.mock("@/lib/db/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

vi.mock("@/lib/db/scoped-repository", () => ({
  createScopedRepository: mocks.createScopedRepository,
}));

vi.mock("@/env", () => ({
  env: { NEXTAUTH_URL: "http://127.0.0.1:3099" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scheduleVersion: {
      findFirst: mocks.scheduleVersionFindFirst,
    },
    assignment: {
      findMany: mocks.assignmentFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { publishScheduleAction } from "@/actions/schedule/publish";

const TIMEZONE = "Asia/Bangkok";

/** สร้าง engine input ที่มี hard violation (assignment ทับเวลา) */
function invalidEngineInput(): ScheduleEngineInput {
  const day = {
    id: "code-day",
    code: "DAY",
    startTime: "08:00",
    endTime: "16:00",
    standardHours: 8,
    allowedGradeIds: ["grade-a"],
    needsConfirmation: false,
    active: true,
  };
  const interval = buildAssignmentInterval(day, "2026-03-01", TIMEZONE);

  return {
    organizationId: "org-a",
    timezone: TIMEZONE,
    cycleStartDate: "2026-03-01",
    cycleEndDate: "2026-03-03",
    assignments: [
      {
        id: "a1",
        staffId: "staff-1",
        shiftCodeId: day.id,
        scheduleDate: "2026-03-01",
        ...interval,
      },
      {
        id: "a2",
        staffId: "staff-1",
        shiftCodeId: day.id,
        scheduleDate: "2026-03-01",
        ...interval,
      },
    ],
    staff: [
      {
        id: "staff-1",
        gradeId: "grade-a",
        fte: 1,
        shiftAuthorizations: [],
      },
    ],
    shiftCodes: [day],
    shiftDemands: [],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: [],
  };
}

/** snapshot canvas สำหรับ publish */
function canvasSnapshot(engineInput: ScheduleEngineInput) {
  return {
    draftId: "draft-1",
    draftVersionId: "draft-version-1",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-03",
    engineInput,
  };
}

describe("publishScheduleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireSchedulePublishAccess.mockResolvedValue({
      organizationId: "org-a",
      userId: "user-scheduler",
      role: "SCHEDULER",
    });

    mocks.createScopedRepository.mockReturnValue({});
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.assignmentFindMany.mockResolvedValue([]);
  });

  it("ปฏิเสธ publish เมื่อมี hard violation โดยไม่มี override", async () => {
    mocks.loadCanvasDraftSnapshot.mockResolvedValue(canvasSnapshot(invalidEngineInput()));

    const result = await publishScheduleAction({
      cycleId: "cycle-1",
      draftId: "draft-1",
      draftVersionId: "draft-version-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("publish สำเร็จ — version ใหม่เป็น PUBLISHED และ version เดิมเป็น SUPERSEDED", async () => {
    const validInput = invalidEngineInput();
    validInput.assignments = validInput.assignments.slice(0, 1);

    mocks.loadCanvasDraftSnapshot.mockResolvedValue(canvasSnapshot(validInput));
    mocks.scheduleVersionFindFirst.mockResolvedValue({ ruleSetVersionId: "rules-1" });

    const previousPublished = {
      id: "published-old",
      status: "PUBLISHED" as const,
      versionNumber: 3,
    };

    const supersededUpdate = vi.fn();
    const createdVersion = { id: "published-new", versionNumber: 4 };

    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        scheduleVersion: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(previousPublished)
            .mockResolvedValueOnce({ versionNumber: 3 }),
          create: vi.fn().mockResolvedValue(createdVersion),
          update: supersededUpdate,
        },
        assignment: {
          createMany: vi.fn(),
        },
        scheduleShareLink: {
          create: vi.fn(),
        },
      };

      return callback(tx);
    });

    const result = await publishScheduleAction({
      cycleId: "cycle-1",
      draftId: "draft-1",
      draftVersionId: "draft-version-1",
      publishReason: "เผยแพร่ e2e",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.versionNumber).toBe(4);
      expect(result.data.shareUrl).toContain("/s/");
      expect(result.data.shareToken.length).toBeGreaterThan(10);
    }

    expect(supersededUpdate).toHaveBeenCalledWith({
      where: { id: "published-old" },
      data: expect.objectContaining({
        status: "SUPERSEDED",
        supersededByVersionId: "published-new",
      }),
    });
  });
});
