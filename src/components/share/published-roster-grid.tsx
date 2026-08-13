import { Card, CardContent } from "@/components/ui/card";
import {
  buildShiftCodeToneLookup,
  formatCellTimeRange,
  type PublishedRosterGridView,
  rosterGridCellClassName,
} from "@/domain/share";

const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

/** label หัวคอลัมน์วัน — วัน + ตัวเลขวันที่ */
function dayHeader(date: string): { weekday: string; day: string } {
  const parsed = new Date(`${date}T12:00:00Z`);
  return {
    weekday: THAI_WEEKDAYS[parsed.getUTCDay()] ?? "",
    day: String(parsed.getUTCDate()),
  };
}

/** ตารางเวรทั้งแผนกแบบอ่านอย่างเดียว — สำหรับหน้า share */
export function PublishedRosterGrid({ grid }: { grid: PublishedRosterGridView }) {
  const shiftMetaByCode = buildShiftCodeToneLookup(grid.shiftCodes);

  if (grid.rows.length === 0 || grid.dates.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          ยังไม่มีตารางเวรในช่วงนี้
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="bg-muted/40 sticky left-0 z-20 border-r border-b px-3 py-2 text-left font-semibold">
                  พนักงาน
                </th>
                {grid.dates.map((date) => {
                  const header = dayHeader(date);
                  const isWeekend = header.weekday === "ส" || header.weekday === "อา";
                  return (
                    <th
                      key={date}
                      className={`border-b px-1.5 py-2 text-center font-medium ${
                        isWeekend ? "bg-muted/70 text-muted-foreground" : ""
                      }`}
                    >
                      <div>{header.weekday}</div>
                      <div>{header.day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.staffProfileId} className="hover:bg-muted/20">
                  <th className="bg-background sticky left-0 z-10 border-r border-b px-3 py-2 text-left font-normal">
                    <div className="max-w-[9rem] truncate font-medium">{row.displayName}</div>
                  </th>
                  {row.cells.map((cell) => {
                    const header = dayHeader(cell.localDate);
                    const isWeekend = header.weekday === "ส" || header.weekday === "อา";
                    const shiftMeta = cell.isNonWorkingDay
                      ? undefined
                      : cell.displayCode
                        ? shiftMetaByCode.get(cell.displayCode)
                        : undefined;
                    const timeRange = formatCellTimeRange({
                      startsAt: cell.startsAt,
                      endsAt: cell.endsAt,
                      timezone: grid.timezone,
                    });

                    return (
                      <td
                        key={`${row.staffProfileId}:${cell.localDate}`}
                        className={`border-b px-1 py-1.5 text-center ${
                          isWeekend ? "bg-muted/30" : ""
                        } ${rosterGridCellClassName({
                          displayCode: cell.displayCode,
                          isNonWorkingDay: cell.isNonWorkingDay,
                          shiftMeta,
                        })}`}
                      >
                        <div>{cell.displayCode ?? "—"}</div>
                        {timeRange ? (
                          <div className="text-[10px] leading-tight opacity-80">{timeRange}</div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
