import type { ConstraintViolation, ValidationResult } from "@/domain/schedule/types";

import { formatViolationDetails, formatViolationMeta, type LabelMap } from "./status-issue-format";

/** เนื้อหา section ข้อจำกัด — ไม่มี Card wrapper */
export function ViolationsSection({
  validation,
  achieved = false,
  staffLabelById = new Map<string, string>(),
  departmentLabelById = new Map<string, string>(),
}: {
  validation: ValidationResult;
  achieved?: boolean;
  staffLabelById?: LabelMap;
  departmentLabelById?: LabelMap;
}) {
  const hardCount = validation.hardViolations.length;
  const softCount = validation.softViolations.length;

  if (achieved && hardCount === 0 && softCount === 0) {
    return <p className="text-muted-foreground text-xs">ผ่าน hard · ไม่พบ soft violation</p>;
  }

  return (
    <div className="space-y-3 text-xs">
      {hardCount === 0 && softCount === 0 ? (
        <p className="text-muted-foreground">ไม่พบ violation ในขอบเขตที่เลือก</p>
      ) : null}

      {hardCount > 0 ? (
        <ViolationList
          title="Hard"
          items={validation.hardViolations}
          tone="destructive"
          staffLabelById={staffLabelById}
          departmentLabelById={departmentLabelById}
        />
      ) : achieved ? (
        <p className="text-muted-foreground">ผ่าน hard</p>
      ) : null}

      {softCount > 0 ? (
        <ViolationList
          title="Soft"
          items={validation.softViolations}
          tone="muted"
          staffLabelById={staffLabelById}
          departmentLabelById={departmentLabelById}
        />
      ) : null}
    </div>
  );
}

/** badge สรุปจำนวน hard/soft สำหรับหัว section */
export function violationsSectionBadge(validation: ValidationResult): {
  readonly hardCount: number;
  readonly softCount: number;
} {
  return {
    hardCount: validation.hardViolations.length,
    softCount: validation.softViolations.length,
  };
}

/** รายการ violation */
function ViolationList({
  title,
  items,
  tone,
  staffLabelById,
  departmentLabelById,
}: {
  title: string;
  items: readonly ConstraintViolation[];
  tone: "destructive" | "muted";
  staffLabelById: LabelMap;
  departmentLabelById: LabelMap;
}) {
  return (
    <div>
      <p
        className={`mb-1 font-medium ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const meta = formatViolationMeta(item, staffLabelById, departmentLabelById);
          const details = formatViolationDetails(item.code, item.details);

          return (
            <li
              key={`${item.code}:${item.staffId ?? ""}:${item.assignmentId ?? ""}:${item.scheduleDate ?? ""}:${item.messageTh}`}
              className="rounded border px-2 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">
                  {item.code}
                </span>
                {item.weight !== undefined && item.weight !== 1 ? (
                  <span className="text-muted-foreground text-[10px]">w={item.weight}</span>
                ) : null}
              </div>
              <p className="mt-1">{item.messageTh}</p>
              {meta ? <p className="text-muted-foreground mt-0.5">{meta}</p> : null}
              {details ? <p className="text-muted-foreground mt-0.5">{details}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
