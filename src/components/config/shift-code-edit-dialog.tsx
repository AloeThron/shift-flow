"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createShiftCodeAction, updateShiftCodeAction } from "@/actions/config/shift-codes";
import { DepartmentMasterPanel } from "@/components/config/department-master-panel";
import { ShiftCodeDemandPanel } from "@/components/config/shift-code-demand-panel";
import { ShiftCodeDepartmentPanel } from "@/components/config/shift-code-department-panel";
import {
  buildShiftCodeFormInput,
  emptyShiftCodeDraft,
  findOrphanGradeCodes,
  type ShiftCodeDraft,
  shiftCodeRowToDraft,
  toggleGradeSelection,
} from "@/components/config/shift-code-form-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DepartmentOption = { id: string; code: string; displayName: string };
type GradeOption = { code: string; displayName: string };

type DepartmentRow = {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
  active: boolean;
};

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

export type ShiftCodeRow = {
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

type ShiftCodeEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  shiftCode?: ShiftCodeRow;
  departments: DepartmentOption[];
  departmentRows: readonly DepartmentRow[];
  demands: DemandRow[];
  grades: GradeOption[];
  canWrite: boolean;
  onCreated?: (id: string) => void;
};

/** แท็บข้อมูลรหัสเวร */
function ShiftCodeDetailsTab({
  draft,
  grades,
  canWrite,
  pending,
  error,
  isCreate,
  onDraftChange,
  onSave,
  onCancel,
}: {
  draft: ShiftCodeDraft;
  grades: GradeOption[];
  canWrite: boolean;
  pending: boolean;
  error: string | null;
  isCreate: boolean;
  onDraftChange: (draft: ShiftCodeDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const activeGradeCodes = grades.map((grade) => grade.code);
  const orphanGradeCodes = findOrphanGradeCodes(draft.allowedGradeCodes, activeGradeCodes);
  const hasGrades = grades.length > 0;
  const canSave = canWrite && hasGrades && draft.allowedGradeCodes.length > 0;

  const patchDraft = (patch: Partial<ShiftCodeDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  const handleGradeToggle = (code: string) => {
    patchDraft({ allowedGradeCodes: toggleGradeSelection(draft.allowedGradeCodes, code) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shift-code-canonical">รหัสหลัก</Label>
          <Input
            id="shift-code-canonical"
            value={draft.canonicalCode}
            onChange={(event) => patchDraft({ canonicalCode: event.target.value })}
            required
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shift-code-standard-hours">ชั่วโมงมาตรฐาน</Label>
          <Input
            id="shift-code-standard-hours"
            value={draft.standardHours}
            onChange={(event) => patchDraft({ standardHours: event.target.value })}
            type="number"
            step="0.5"
            min={0}
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shift-code-start">เวลาเริ่ม</Label>
          <Input
            id="shift-code-start"
            value={draft.startTime}
            onChange={(event) => patchDraft({ startTime: event.target.value })}
            placeholder="08:00"
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shift-code-end">เวลาจบ</Label>
          <Input
            id="shift-code-end"
            value={draft.endTime}
            onChange={(event) => patchDraft({ endTime: event.target.value })}
            placeholder="16:00"
            disabled={!canWrite || pending}
          />
        </div>
        <fieldset className="space-y-1 sm:col-span-2">
          <legend className="text-sm font-medium">ระดับพนักงานที่ใช้ได้</legend>
          {hasGrades ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {grades.map((grade) => (
                <label key={grade.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.allowedGradeCodes.includes(grade.code)}
                    onChange={() => handleGradeToggle(grade.code)}
                    disabled={!canWrite || pending}
                  />
                  {grade.code} — {grade.displayName}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">ยังไม่มีระดับพนักงาน — ตั้งค่าที่หน้าบุคลากรก่อน</p>
          )}
          {orphanGradeCodes.length > 0 ? (
            <p className="text-amber-600 text-xs">
              ระดับที่ไม่อยู่ใน master จะถูกตัดออกเมื่อบันทึก: {orphanGradeCodes.join(", ")}
            </p>
          ) : null}
          {draft.allowedGradeCodes.length === 0 && hasGrades ? (
            <p className="text-destructive text-xs">ต้องเลือกระดับพนักงานอย่างน้อย 1 รายการ</p>
          ) : null}
        </fieldset>
        <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.needsConfirmation}
              onChange={(event) => patchDraft({ needsConfirmation: event.target.checked })}
              disabled={!canWrite || pending}
            />
            รอยืนยันความหมาย
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.deprecated}
              onChange={(event) => patchDraft({ deprecated: event.target.checked })}
              disabled={!canWrite || pending}
            />
            เลิกใช้
          </label>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending || !canSave} onClick={onSave}>
            {pending ? "กำลังบันทึก..." : isCreate ? "บันทึกและดำเนินการต่อ" : "บันทึกข้อมูลรหัส"}
          </Button>
          {isCreate ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              ยกเลิก
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Dialog แก้ไข/สร้างรหัสเวร 3 แท็บ */
export function ShiftCodeEditDialog({
  open,
  onOpenChange,
  mode,
  shiftCode,
  departments,
  departmentRows,
  demands,
  grades,
  canWrite,
  onCreated,
}: ShiftCodeEditDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("details");
  const [error, setError] = useState<string | null>(null);
  const [savedShiftCodeId, setSavedShiftCodeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShiftCodeDraft>(() =>
    shiftCode ? shiftCodeRowToDraft(shiftCode) : emptyShiftCodeDraft(grades.map((g) => g.code)),
  );

  const gradeCodes = useMemo(() => grades.map((grade) => grade.code), [grades]);
  const effectiveShiftCodeId = savedShiftCodeId ?? shiftCode?.id ?? null;
  const secondaryTabsLocked = !effectiveShiftCodeId;
  const dialogTitle =
    mode === "create" && !effectiveShiftCodeId
      ? "เพิ่มรหัสเวร"
      : `แก้ไข — ${draft.canonicalCode || shiftCode?.canonicalCode || ""}`;

  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setActiveTab("details");
      setError(null);
      setSavedShiftCodeId(null);
      setDraft(shiftCode ? shiftCodeRowToDraft(shiftCode) : emptyShiftCodeDraft(gradeCodes));
    }
    prevOpenRef.current = open;
  }, [open, shiftCode, gradeCodes]);

  const effectiveShiftCode = useMemo((): ShiftCodeRow | null => {
    if (!effectiveShiftCodeId) return null;

    const base = shiftCode?.id === effectiveShiftCodeId ? shiftCode : null;
    return {
      id: effectiveShiftCodeId,
      canonicalCode: draft.canonicalCode,
      departmentId: base?.departmentId ?? (draft.departmentId || null),
      startTime: draft.startTime || null,
      endTime: draft.endTime || null,
      standardHours: draft.standardHours ? Number(draft.standardHours) : null,
      allowedGradeCodes: [...draft.allowedGradeCodes],
      needsConfirmation: draft.needsConfirmation,
      deprecated: draft.deprecated,
      department: base?.department ?? null,
      minHeadcountTotal: base?.minHeadcountTotal ?? 0,
    };
  }, [draft, effectiveShiftCodeId, shiftCode]);

  const handleTabChange = (value: string) => {
    if (secondaryTabsLocked && (value === "department" || value === "demand")) {
      return;
    }
    setActiveTab(value);
  };

  const handleSaveDetails = () => {
    if (!canWrite) return;

    startTransition(async () => {
      setError(null);
      const input = buildShiftCodeFormInput(draft);
      const isCreate = mode === "create" && !effectiveShiftCodeId;

      const result = isCreate
        ? await createShiftCodeAction(input)
        : await updateShiftCodeAction(effectiveShiftCodeId ?? shiftCode!.id, input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (isCreate && result.data) {
        setSavedShiftCodeId(result.data.id);
        onCreated?.(result.data.id);
      }

      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85vh,720px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="details">ข้อมูลรหัส</TabsTrigger>
            <TabsTrigger value="department" disabled={secondaryTabsLocked}>
              แผนก
              {secondaryTabsLocked ? (
                <span className="text-muted-foreground ml-1 hidden text-[10px] sm:inline">
                  (บันทึกข้อมูลรหัสก่อน)
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="demand" disabled={secondaryTabsLocked}>
              กำลังคนขั้นต่ำ
              {secondaryTabsLocked ? (
                <span className="text-muted-foreground ml-1 hidden text-[10px] sm:inline">
                  (บันทึกข้อมูลรหัสก่อน)
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {secondaryTabsLocked ? (
            <p className="text-muted-foreground text-xs">
              บันทึกข้อมูลรหัสก่อน จึงจะกำหนดแผนกและ demand ได้
            </p>
          ) : null}

          <TabsContent value="details" className="mt-4">
            <ShiftCodeDetailsTab
              draft={draft}
              grades={grades}
              canWrite={canWrite}
              pending={pending}
              error={error}
              isCreate={mode === "create" && !effectiveShiftCodeId}
              onDraftChange={setDraft}
              onSave={handleSaveDetails}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="department" className="mt-4 space-y-6">
            {effectiveShiftCode ? (
              <>
                <ShiftCodeDepartmentPanel
                  shiftCodeId={effectiveShiftCode.id}
                  canonicalCode={effectiveShiftCode.canonicalCode}
                  departmentId={effectiveShiftCode.departmentId}
                  departments={departments}
                  canWrite={canWrite}
                />
                <div className="border-t pt-4">
                  <DepartmentMasterPanel departments={departmentRows} canWrite={canWrite} />
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="demand" className="mt-4">
            {effectiveShiftCode ? (
              <ShiftCodeDemandPanel
                shiftCodeId={effectiveShiftCode.id}
                canonicalCode={effectiveShiftCode.canonicalCode}
                demands={demands}
                canWrite={canWrite}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
