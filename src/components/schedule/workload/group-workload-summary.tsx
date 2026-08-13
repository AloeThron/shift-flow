import {
  FAIRNESS_DIMENSION_LABELS,
  formatWorkloadNumber,
  WORKLOAD_METRIC_LABELS,
} from "@/components/schedule/workload/workload-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroupWorkloadStats } from "@/domain/optimize/fairness/workload-stats";

/** สรุป workload และ fairness ต่อกลุ่ม */
export function GroupWorkloadSummary({
  groups,
  fairDimension,
  toleranceHours,
}: {
  groups: readonly GroupWorkloadStats[];
  fairDimension: keyof typeof FAIRNESS_DIMENSION_LABELS;
  toleranceHours: number;
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          ยังไม่มีข้อมูลกลุ่ม
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.groupKey}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {group.groupName}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {group.staffCount} คน
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricSpreadBlock
                label={WORKLOAD_METRIC_LABELS.plannedHours}
                spread={group.lookbackSpreads.plannedHours}
              />
              <MetricSpreadBlock
                label={WORKLOAD_METRIC_LABELS.otHours}
                spread={group.lookbackSpreads.otHours}
              />
              <MetricSpreadBlock
                label={WORKLOAD_METRIC_LABELS.nightCount}
                spread={group.lookbackSpreads.nightCount}
              />
              <MetricSpreadBlock
                label={WORKLOAD_METRIC_LABELS.weekendCount}
                spread={group.lookbackSpreads.weekendCount}
              />
            </div>

            {group.fairnessReport ? (
              <div className="bg-muted/40 rounded-md border px-3 py-2">
                <p className="font-medium">
                  ความเป็นธรรม ({FAIRNESS_DIMENSION_LABELS[fairDimension]})
                </p>
                <p className="text-muted-foreground mt-1">
                  min {formatWorkloadNumber(group.fairnessReport.spread.min)} · max{" "}
                  {formatWorkloadNumber(group.fairnessReport.spread.max)} · spread{" "}
                  {formatWorkloadNumber(group.fairnessReport.spread.spread)} · Gini{" "}
                  {formatWorkloadNumber(group.fairnessReport.gini, 2)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  tolerance ±{toleranceHours} ชม. — solver ใช้ carry-over offset จากค่านี้
                </p>
              </div>
            ) : null}

            {group.outOfTolerance.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">เกินช่วงยอมรับ</p>
                <ul className="space-y-1">
                  {group.outOfTolerance.map((entry) => (
                    <li key={entry.staffId} className="text-muted-foreground">
                      {entry.displayName} ({entry.staffCode}) — {formatWorkloadNumber(entry.value)}{" "}
                      ต่างจากค่ากลาง {formatWorkloadNumber(entry.deviation)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">ไม่มีคนเกิน tolerance ในกลุ่มนี้</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** แสดง min/max/spread ของ metric */
function MetricSpreadBlock({
  label,
  spread,
}: {
  label: string;
  spread: { min: number; max: number; spread: number };
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground mt-1">
        {formatWorkloadNumber(spread.min)} – {formatWorkloadNumber(spread.max)} (spread{" "}
        {formatWorkloadNumber(spread.spread)})
      </p>
    </div>
  );
}
