import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffWorkloadTrend } from "@/domain/optimize/fairness/workload-stats";

import {
  formatWorkloadNumber,
  formatYearMonthLabel,
  WORKLOAD_METRIC_LABELS,
} from "@/components/schedule/workload/workload-labels";

/** ตาราง workload ต่อคนพร้อมแนวโน้มรายเดือน */
export function StaffWorkloadTable({
  trends,
  lookbackMonths,
  currentCycleLabel,
}: {
  trends: readonly StaffWorkloadTrend[];
  lookbackMonths: readonly string[];
  currentCycleLabel?: string;
}) {
  if (trends.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          ไม่มีข้อมูล workload ที่แสดงได้
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {trends.map((trend) => (
        <Card key={trend.staffId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {trend.displayName}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {trend.staffCode}
                {trend.staffGroupName ? ` · ${trend.staffGroupName}` : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <SummaryChip
                label="สะสมย้อนหลัง (per FTE)"
                value={`${formatWorkloadNumber(trend.lookbackTotalsPerFte.plannedHours)} ชม.`}
              />
              <SummaryChip
                label="OT สะสม"
                value={`${formatWorkloadNumber(trend.lookbackTotalsPerFte.otHours)} ชม.`}
              />
              <SummaryChip
                label="carry-over offset"
                value={formatWorkloadNumber(trend.carryOverOffset)}
              />
              <SummaryChip
                label="ข้อมูลย้อนหลัง"
                value={`${trend.lookbackMonthsPresent}/${trend.lookbackMonthsExpected} เดือน`}
                hint={
                  trend.lookbackMonthsPresent < trend.lookbackMonthsExpected
                    ? "ข้อมูลไม่ครบ — normalize ตามเดือนที่มีจริง"
                    : undefined
                }
              />
            </div>

            {trend.currentCycle ? (
              <CurrentCycleStatus trend={trend} cycleLabel={currentCycleLabel} />
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">เดือน</th>
                    <th className="py-2 pr-3 font-medium">{WORKLOAD_METRIC_LABELS.plannedHours}</th>
                    <th className="py-2 pr-3 font-medium">{WORKLOAD_METRIC_LABELS.otHours}</th>
                    <th className="py-2 pr-3 font-medium">{WORKLOAD_METRIC_LABELS.nightCount}</th>
                    <th className="py-2 pr-3 font-medium">{WORKLOAD_METRIC_LABELS.weekendCount}</th>
                    <th className="py-2 pr-3 font-medium">{WORKLOAD_METRIC_LABELS.workedDays}</th>
                    <th className="py-2 pr-3 font-medium">{WORKLOAD_METRIC_LABELS.daysOff}</th>
                  </tr>
                </thead>
                <tbody>
                  {lookbackMonths
                    .filter((yearMonth) => yearMonth !== trend.currentCycle?.yearMonth)
                    .map((yearMonth) => {
                      const row = trend.monthlyRows.find((entry) => entry.yearMonth === yearMonth);
                      return (
                        <tr key={yearMonth} className="border-b last:border-0">
                          <td className="text-muted-foreground py-2 pr-3">
                            {formatYearMonthLabel(yearMonth)}
                            {row?.source === "COMPUTED" ? " *" : ""}
                          </td>
                          <td className="py-2 pr-3">
                            {row ? formatWorkloadNumber(row.plannedHours) : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            {row ? formatWorkloadNumber(row.otHours) : "—"}
                          </td>
                          <td className="py-2 pr-3">{row?.nightCount ?? "—"}</td>
                          <td className="py-2 pr-3">{row?.weekendCount ?? "—"}</td>
                          <td className="py-2 pr-3">{row?.workedDays ?? "—"}</td>
                          <td className="py-2 pr-3">{row?.daysOff ?? "—"}</td>
                        </tr>
                      );
                    })}
                  {trend.currentCycle ? (
                    <tr className="bg-muted/30 border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        {currentCycleLabel ?? formatYearMonthLabel(trend.currentCycle.yearMonth)}{" "}
                        (รอบปัจจุบัน)
                      </td>
                      <td className="py-2 pr-3">
                        {formatWorkloadNumber(trend.currentCycle.plannedHours)}
                      </td>
                      <td className="py-2 pr-3">
                        {formatWorkloadNumber(trend.currentCycle.otHours)}
                      </td>
                      <td className="py-2 pr-3">{trend.currentCycle.nightCount}</td>
                      <td className="py-2 pr-3">{trend.currentCycle.weekendCount}</td>
                      <td className="py-2 pr-3">{trend.currentCycle.workedDays}</td>
                      <td className="py-2 pr-3">{trend.currentCycle.daysOff}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <TrendBars trend={trend} lookbackMonths={lookbackMonths} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** สรุปรอบปัจจุบันเทียบเป้าและ OT limit */
function CurrentCycleStatus({
  trend,
  cycleLabel,
}: {
  trend: StaffWorkloadTrend;
  cycleLabel?: string;
}) {
  const cycle = trend.currentCycle;
  if (!cycle) {
    return null;
  }

  const hoursProgress =
    trend.targetHoursPerMonth && trend.targetHoursPerMonth > 0
      ? Math.round((cycle.plannedHours / trend.targetHoursPerMonth) * 100)
      : undefined;

  return (
    <div className="bg-muted/40 rounded-md border px-3 py-2">
      <p className="font-medium">{cycleLabel ?? "รอบที่กำลังจัด"}</p>
      <p className="text-muted-foreground mt-1">
        {formatWorkloadNumber(cycle.plannedHours)} ชม. ตามแผน
        {trend.targetHoursPerMonth
          ? ` / เป้า ${formatWorkloadNumber(trend.targetHoursPerMonth)} ชม.`
          : ""}
        {hoursProgress !== undefined ? ` (${hoursProgress}%)` : ""}
        {" · "}
        OT {formatWorkloadNumber(cycle.otHours)} ชม.
      </p>
    </div>
  );
}

/** แถบ trend ชม.ตามแผน 6 เดือน */
function TrendBars({
  trend,
  lookbackMonths,
}: {
  trend: StaffWorkloadTrend;
  lookbackMonths: readonly string[];
}) {
  const values = lookbackMonths
    .filter((yearMonth) => yearMonth !== trend.currentCycle?.yearMonth)
    .map(
      (yearMonth) =>
        trend.monthlyRows.find((row) => row.yearMonth === yearMonth)?.plannedHours ?? 0,
    );
  const max = Math.max(...values, trend.currentCycle?.plannedHours ?? 0, 1);

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs">แนวโน้มชม.ตามแผน (6 เดือน)</p>
      <div className="flex h-16 items-end gap-1">
        {lookbackMonths
          .filter((yearMonth) => yearMonth !== trend.currentCycle?.yearMonth)
          .map((yearMonth) => {
            const value =
              trend.monthlyRows.find((row) => row.yearMonth === yearMonth)?.plannedHours ?? 0;
            const height = Math.max(4, Math.round((value / max) * 100));
            return (
              <div key={yearMonth} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="bg-primary/70 w-full rounded-sm"
                  style={{ height: `${height}%` }}
                  title={`${formatYearMonthLabel(yearMonth)}: ${formatWorkloadNumber(value)} ชม.`}
                />
                <span className="text-muted-foreground text-[10px]">
                  {formatYearMonthLabel(yearMonth)}
                </span>
              </div>
            );
          })}
        {trend.currentCycle ? (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="bg-primary w-full rounded-sm"
              style={{
                height: `${Math.max(4, Math.round((trend.currentCycle.plannedHours / max) * 100))}%`,
              }}
              title={`รอบปัจจุบัน: ${formatWorkloadNumber(trend.currentCycle.plannedHours)} ชม.`}
            />
            <span className="text-muted-foreground text-[10px]">รอบ</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** chip สรุปค่าเดียว */
function SummaryChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
