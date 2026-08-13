import type { FeasibilityIssue } from "@/domain/schedule/types";

import {
  filterCoverageGapIssues,
  formatCoverageGapDisplay,
  type LabelMap,
} from "./status-issue-format";

export { filterCoverageGapIssues } from "./status-issue-format";

/** เนื้อหา section coverage gap — ไม่มี Card wrapper */
export function CoverageGapSection({
  issues,
  achieved = false,
  departmentLabelById = new Map<string, string>(),
  shiftCodeLabelById = new Map<string, string>(),
}: {
  issues: readonly FeasibilityIssue[];
  achieved?: boolean;
  departmentLabelById?: LabelMap;
  shiftCodeLabelById?: LabelMap;
}) {
  const coverageIssues = filterCoverageGapIssues(issues);

  if (achieved && coverageIssues.length === 0) {
    return <p className="text-muted-foreground text-xs">ไม่พบ coverage gap</p>;
  }

  return (
    <div className="text-xs">
      {coverageIssues.length === 0 ? (
        <p className="text-muted-foreground">ไม่พบช่องว่าง coverage ในขอบเขตที่ตรวจ</p>
      ) : (
        <ul className="space-y-1">
          {coverageIssues.map((issue) => {
            const display = formatCoverageGapDisplay(
              issue,
              departmentLabelById,
              shiftCodeLabelById,
            );

            return (
              <li
                key={`${issue.kind}:${issue.scheduleDate ?? ""}:${issue.shiftCodeId ?? ""}:${issue.requirementId ?? ""}:${issue.startTime ?? ""}:${issue.endTime ?? ""}:${issue.messageTh}`}
                className="rounded border px-2 py-1.5"
              >
                <p>{display.headline}</p>
                <p className="text-muted-foreground mt-0.5">{display.meta}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
