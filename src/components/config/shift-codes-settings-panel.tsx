"use client";

import { useMemo, useState } from "react";

import { ShiftCodeEditDialog, type ShiftCodeRow } from "@/components/config/shift-code-edit-dialog";
import {
  SHIFT_CODE_TABLE_COLUMNS,
  SHIFT_CODE_TABLE_MIN_WIDTH,
  shiftCodeTableHeadClass,
} from "@/components/config/shift-code-table-layout";
import { ShiftCodeTableRow } from "@/components/config/shift-code-table-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DepartmentOption = { id: string; code: string; displayName: string };
type GradeOption = { code: string; displayName: string };
type DemandRow = {
  id: string;
  name: string;
  minHeadcount: number;
  requiresLead: boolean;
  weekdayMask: number;
  appliesOnHolidays: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  active: boolean;
};

type ShiftCodesSettingsPanelProps = {
  shiftCodes: ShiftCodeRow[];
  departments: DepartmentOption[];
  departmentRows: readonly {
    id: string;
    code: string;
    displayName: string;
    sortOrder: number;
    active: boolean;
  }[];
  demandsByShiftCodeId: ReadonlyMap<string, readonly DemandRow[]>;
  grades: GradeOption[];
  canWrite: boolean;
};

type DialogState = {
  open: boolean;
  mode: "create" | "edit";
  shiftCodeId?: string;
};

/** panel ตาราง read-only สำหรับ shift code — แก้ไขผ่าน dialog */
export function ShiftCodesSettingsPanel({
  shiftCodes,
  departments,
  departmentRows,
  demandsByShiftCodeId,
  grades,
  canWrite,
}: ShiftCodesSettingsPanelProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const byId = useMemo(() => new Map(shiftCodes.map((code) => [code.id, code])), [shiftCodes]);

  const activeShiftCode =
    dialog?.mode === "edit" && dialog.shiftCodeId ? byId.get(dialog.shiftCodeId) : undefined;

  const activeDemands =
    dialog?.shiftCodeId != null ? [...(demandsByShiftCodeId.get(dialog.shiftCodeId) ?? [])] : [];

  const openCreate = () => {
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = (id: string) => {
    setDialog({ open: true, mode: "edit", shiftCodeId: id });
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setDialog(null);
      return;
    }
    setDialog((current) => (current ? { ...current, open: true } : null));
  };

  const handleCreated = (id: string) => {
    setDialog({ open: true, mode: "edit", shiftCodeId: id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-base">รายการรหัส ({shiftCodes.length})</CardTitle>
        {canWrite ? (
          <Button type="button" size="sm" disabled={dialog?.open === true} onClick={openCreate}>
            เพิ่มรหัสเวร
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        <table
          className="w-full table-fixed text-sm"
          style={{ minWidth: SHIFT_CODE_TABLE_MIN_WIDTH }}
        >
          <colgroup>
            {SHIFT_CODE_TABLE_COLUMNS.map((column) => (
              <col key={column.id} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b">
              {SHIFT_CODE_TABLE_COLUMNS.map((column) => (
                <th key={column.id} className={shiftCodeTableHeadClass}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shiftCodes.map((code) => (
              <ShiftCodeTableRow
                key={code.id}
                row={code}
                canWrite={canWrite}
                dialogOpen={dialog?.open === true}
                onOpenEdit={openEdit}
              />
            ))}
          </tbody>
        </table>
      </CardContent>

      {dialog ? (
        <ShiftCodeEditDialog
          open={dialog.open}
          onOpenChange={handleDialogOpenChange}
          mode={dialog.mode}
          shiftCode={activeShiftCode}
          departments={departments}
          departmentRows={departmentRows}
          demands={activeDemands}
          grades={grades}
          canWrite={canWrite}
          onCreated={handleCreated}
        />
      ) : null}
    </Card>
  );
}
