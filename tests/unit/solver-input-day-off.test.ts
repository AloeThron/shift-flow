import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    NEXTAUTH_URL: "http://127.0.0.1:3099",
    AUTH_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    DIRECT_URL: "postgresql://test",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import type { ScheduleEngineInput } from "@/domain/schedule/types";
import { buildDefaultSchedulingPolicySnapshot } from "@/domain/scheduling/policy";
import type { CanvasDraftSnapshot } from "@/lib/scheduling/load-canvas-draft";
import type { HistoryWindowSnapshot } from "@/lib/scheduling/load-history-window";
import { buildDayOffPlanInput, buildHistoricalOffDates } from "@/lib/scheduling/solver-input";

const OFF_KIND = "kind-off";

/** snapshot canvas ขั้นต่ำสำหรับทดสอบ buildDayOffPlanInput */
function canvasSnapshot(engineInput: ScheduleEngineInput): CanvasDraftSnapshot {
  return {
    cycleId: "cycle-a",
    cycleName: "Mar 2026",
    periodStart: engineInput.cycleStartDate,
    periodEnd: engineInput.cycleEndDate,
    draftId: "draft-a",
    draftVersionId: "version-a",
    optimisticVersion: 1,
    timezone: "Asia/Bangkok",
    grid: { dates: [], holidayDates: [], rows: [] },
    shiftCodes: [],
    nonWorkingDayKinds: [],
    departments: [],
    staffGroups: [],
    engineInput,
    defaultOffKindId: OFF_KIND,
    staffDayOffQuotas: engineInput.staffDayOffQuotas ?? {},
    defaultDayOffQuota: 8,
  };
}

/** history window ขั้นต่ำ */
function historySnapshot(overrides: Partial<HistoryWindowSnapshot> = {}): HistoryWindowSnapshot {
  return {
    policy: buildDefaultSchedulingPolicySnapshot("org-a", "2026-02-28"),
    asOfDate: "2026-02-28",
    windowStart: "2026-02-01",
    windowEnd: "2026-02-28",
    fairnessLookbackMonths: ["2026-02"],
    assignments: [],
    plannedNonWorkingDays: [],
    staffWorkloadMonthly: [],
    staff: [],
    shiftCodes: [],
    holidayDates: [],
    ...overrides,
  };
}

describe("buildDayOffPlanInput — dayOffRequests", () => {
  it("ส่งเฉพาะ planned off ที่ source เป็น REQUEST และไม่ locked", () => {
    const engineInput: ScheduleEngineInput = {
      organizationId: "org-a",
      timezone: "Asia/Bangkok",
      cycleStartDate: "2026-03-01",
      cycleEndDate: "2026-03-31",
      holidayDates: [],
      staff: [
        {
          id: "staff-1",
          gradeId: "grade-a",
          staffGroupId: "group-a",
          fte: 1,
          shiftAuthorizations: [],
        },
      ],
      shiftCodes: [],
      assignments: [],
      shiftDemands: [],
      ruleInstances: [],
      plannedNonWorkingDays: [
        {
          staffId: "staff-1",
          localDate: "2026-03-05",
          nonWorkingDayKindId: OFF_KIND,
          blocksScheduling: true,
          source: "REQUEST",
        },
        {
          staffId: "staff-1",
          localDate: "2026-03-10",
          nonWorkingDayKindId: OFF_KIND,
          blocksScheduling: true,
          source: "QUOTA",
        },
        {
          staffId: "staff-1",
          localDate: "2026-03-12",
          nonWorkingDayKindId: OFF_KIND,
          blocksScheduling: true,
          locked: true,
          source: "REQUEST",
        },
      ],
    };

    const planInput = buildDayOffPlanInput(canvasSnapshot(engineInput), historySnapshot());

    expect(planInput.dayOffRequests).toEqual([{ staffId: "staff-1", localDate: "2026-03-05" }]);
  });
});

describe("buildHistoricalOffDates", () => {
  it("รวม planned off ที่ blocksScheduling จาก history window", () => {
    const rows = buildHistoricalOffDates(
      historySnapshot({
        plannedNonWorkingDays: [
          {
            staffId: "staff-1",
            localDate: "2026-02-20",
            nonWorkingDayKindId: OFF_KIND,
            blocksScheduling: true,
            source: "QUOTA",
          },
          {
            staffId: "staff-1",
            localDate: "2026-02-21",
            nonWorkingDayKindId: OFF_KIND,
            blocksScheduling: false,
            source: "MANUAL",
          },
        ],
      }),
    );

    expect(rows).toEqual([{ staffId: "staff-1", localDate: "2026-02-20" }]);
  });
});
