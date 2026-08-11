import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkloadStatsSnapshot } from "@/domain/optimize/fairness/workload-stats";
import type { FeasibilityIssue, ValidationResult } from "@/domain/schedule/types";

import { CoverageGapSection } from "./coverage-gap-panel";
import { computeScheduleAchievementStatus } from "./schedule-achievement";
import type { LabelMap } from "./status-issue-format";
import { coverageGapSectionBadge } from "./status-issue-format";
import { ViolationsSection, violationsSectionBadge } from "./violations-panel";
import { countOutOfToleranceStaff, WorkloadSummarySection } from "./workload-summary-panel";

/** แผงสถานะรวมใต้ตาราง canvas — card เดียว 3 คอลัมน์ */
export function ScheduleStatusPanel({
  validation,
  coverageIssues,
  workloadSnapshot,
  staffLabelById = new Map<string, string>(),
  departmentLabelById = new Map<string, string>(),
  shiftCodeLabelById = new Map<string, string>(),
}: {
  validation: ValidationResult;
  coverageIssues: readonly FeasibilityIssue[];
  workloadSnapshot: WorkloadStatsSnapshot | null;
  staffLabelById?: LabelMap;
  departmentLabelById?: LabelMap;
  shiftCodeLabelById?: LabelMap;
}) {
  const achievement = computeScheduleAchievementStatus(
    validation,
    coverageIssues,
    workloadSnapshot,
  );
  const { hardCount, softCount } = violationsSectionBadge(validation);
  const { gapCount, uniqueDateCount } = coverageGapSectionBadge(coverageIssues);
  const outOfToleranceCount = workloadSnapshot ? countOutOfToleranceStaff(workloadSnapshot) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">สถานะการจัดเวร</CardTitle>
          <ScheduleStatusBadge achievement={achievement} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3 md:gap-0">
          <section className="min-w-0 md:pr-4">
            <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
              ข้อจำกัด
              {hardCount > 0 ? (
                <span className="text-destructive text-xs font-normal">{hardCount} hard</span>
              ) : (
                <span className="text-muted-foreground text-xs font-normal">ผ่าน hard</span>
              )}
              {softCount > 0 ? (
                <span className="text-muted-foreground text-xs font-normal">{softCount} soft</span>
              ) : null}
            </h3>
            <ViolationsSection
              validation={validation}
              achieved={achievement.passesHard}
              staffLabelById={staffLabelById}
              departmentLabelById={departmentLabelById}
            />
          </section>

          <section className="min-w-0 border-t pt-4 md:border-t-0 md:border-l md:px-4 md:pt-0">
            <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
              Coverage gap
              {gapCount > 0 ? (
                <span className="text-destructive text-xs font-normal">
                  {uniqueDateCount} วัน · {gapCount} ช่องว่าง
                </span>
              ) : null}
            </h3>
            <CoverageGapSection
              issues={coverageIssues}
              achieved={achievement.passesCoverage}
              departmentLabelById={departmentLabelById}
              shiftCodeLabelById={shiftCodeLabelById}
            />
          </section>

          <section className="min-w-0 border-t pt-4 md:border-t-0 md:border-l md:pl-4 md:pt-0">
            <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
              ภาระงาน &amp; fairness
              {workloadSnapshot?.fairParams && outOfToleranceCount > 0 ? (
                <span className="text-destructive text-xs font-normal">
                  เกิน tolerance {outOfToleranceCount} คน
                </span>
              ) : null}
            </h3>
            {workloadSnapshot ? (
              <WorkloadSummarySection
                snapshot={workloadSnapshot}
                achieved={achievement.passesFairness}
              />
            ) : (
              <p className="text-muted-foreground text-xs">กำลังโหลดข้อมูลภาระงาน…</p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

/** badge สรุปสถานะรวมที่หัว card */
function ScheduleStatusBadge({
  achievement,
}: {
  achievement: ReturnType<typeof computeScheduleAchievementStatus>;
}) {
  if (achievement.isAchieved) {
    return (
      <span
        className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium"
        aria-live="polite"
      >
        พร้อมเผยแพร่
      </span>
    );
  }

  return (
    <span
      className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs font-medium"
      aria-live="polite"
    >
      เหลือ {achievement.remainingIssueCount} ปัญหา
    </span>
  );
}
