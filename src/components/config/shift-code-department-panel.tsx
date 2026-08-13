"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateShiftCodeDepartmentAction } from "@/actions/config/shift-codes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type DepartmentOption = { id: string; code: string; displayName: string };

type ShiftCodeDepartmentPanelProps = {
  shiftCodeId: string;
  canonicalCode: string;
  departmentId: string | null;
  departments: DepartmentOption[];
  canWrite: boolean;
};

/** panel กำหนดแผนกของรหัสเวรใน popover */
export function ShiftCodeDepartmentPanel({
  shiftCodeId,
  canonicalCode,
  departmentId,
  departments,
  canWrite,
}: ShiftCodeDepartmentPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(departmentId ?? "");

  const handleSave = () => {
    if (!canWrite) return;

    startTransition(async () => {
      setError(null);
      const result = await updateShiftCodeDepartmentAction(shiftCodeId, {
        departmentId: selectedId || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">แผนกที่ผูกกับรหัส {canonicalCode}</p>

      <div className="space-y-1">
        <Label htmlFor={`department-${shiftCodeId}`}>แผนก</Label>
        <NativeSelect
          id={`department-${shiftCodeId}`}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={!canWrite || pending}
        >
          <option value="">— ไม่ระบุ —</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.code} — {dept.displayName}
            </option>
          ))}
        </NativeSelect>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {canWrite ? (
        <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      ) : null}
    </div>
  );
}
