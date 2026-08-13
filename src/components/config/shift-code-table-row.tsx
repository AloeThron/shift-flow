"use client";

import type { ReactNode } from "react";

import { formatShiftTimeRange } from "@/components/config/shift-code-form-utils";
import {
  shiftCodeTableCellClass,
  shiftCodeTableCellContentClass,
} from "@/components/config/shift-code-table-layout";
import { ActiveBadge } from "@/components/config/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShiftCodeRowData = {
  id: string;
  canonicalCode: string;
  departmentId: string | null;
  startTime: string | null;
  endTime: string | null;
  standardHours: number | null;
  allowedGradeCodes: string[];
  needsConfirmation: boolean;
  deprecated: boolean;
  department: { code: string } | null;
  minHeadcountTotal: number;
};

type ShiftCodeTableRowProps = {
  row: ShiftCodeRowData;
  canWrite: boolean;
  dialogOpen: boolean;
  onOpenEdit: (id: string) => void;
};

/** cell กลางตารางพร้อม wrapper จัดเนื้อหา */
function TableCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <td className={cn(shiftCodeTableCellClass, className)}>
      <div className={shiftCodeTableCellContentClass}>{children}</div>
    </td>
  );
}

/** แถวตารางรหัสเวร — แสดงผล read-only */
export function ShiftCodeTableRow({
  row,
  canWrite,
  dialogOpen,
  onOpenEdit,
}: ShiftCodeTableRowProps) {
  return (
    <tr className="border-b last:border-0">
      <TableCell>
        <span className="font-mono">{row.canonicalCode}</span>
      </TableCell>

      <TableCell>
        <span>{row.department?.code ?? "—"}</span>
      </TableCell>

      <TableCell>
        <span className="whitespace-nowrap text-xs sm:text-sm">
          {formatShiftTimeRange(row.startTime, row.endTime)}
        </span>
      </TableCell>

      <TableCell>
        <span>{row.standardHours ?? "—"}</span>
      </TableCell>

      <TableCell>
        <span>{row.minHeadcountTotal > 0 ? row.minHeadcountTotal : "—"}</span>
      </TableCell>

      <TableCell>
        <span className="text-xs leading-snug">{row.allowedGradeCodes.join(", ")}</span>
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {row.deprecated ? (
            <span className="bg-muted rounded-full px-2 py-0.5 text-xs">เลิกใช้</span>
          ) : (
            <ActiveBadge active={!row.deprecated} />
          )}
          {row.needsConfirmation ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              รอยืนยัน
            </span>
          ) : null}
        </div>
      </TableCell>

      <TableCell>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={dialogOpen}
          onClick={() => onOpenEdit(row.id)}
        >
          {canWrite ? "แก้ไข" : "ดู"}
        </Button>
      </TableCell>
    </tr>
  );
}
