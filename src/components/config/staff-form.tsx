"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createStaffProfileAction,
  deactivateStaffProfileAction,
  updateStaffProfileAction,
} from "@/actions/config/staff";
import { AdvancedSection } from "@/components/config/advanced-section";
import {
  CONTRACT_TYPE_LABELS,
  STAFF_GROUP_SECTION_LABELS,
} from "@/components/config/ui-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { StaffGroupSection } from "@/domain/schedule/canvas-grid";

type GradeOption = { id: string; code: string; displayName: string };
type GroupOption = { id: string; code: string; displayName: string };

type StaffFormProps = {
  grades: GradeOption[];
  groups: GroupOption[];
  canWrite: boolean;
  initial?: {
    id: string;
    staffCode: string;
    displayName: string;
    email: string | null;
    staffGradeId: string;
    staffGroupId: string | null;
    staffGroupSection: StaffGroupSection;
    rowOrder: number;
    active: boolean;
    contractType: "FULL_TIME" | "PART_TIME" | "NO_GUARANTEED_HOURS";
    fte: number;
  };
  onDone?: () => void;
};

/** ฟอร์มสร้าง/แก้ไขบุคลากร */
export function StaffForm({ grades, groups, canWrite, initial, onDone }: StaffFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    if (!canWrite) return;

    const input = {
      staffCode: String(formData.get("staffCode") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      staffGradeId: String(formData.get("staffGradeId") ?? ""),
      staffGroupId: String(formData.get("staffGroupId") ?? ""),
      staffGroupSection: String(formData.get("staffGroupSection") ?? "RESULT_CAPABLE") as StaffGroupSection,
      rowOrder: Number(formData.get("rowOrder") ?? 0),
      active: formData.get("active") === "on",
      contractType: String(formData.get("contractType") ?? "FULL_TIME") as
        | "FULL_TIME"
        | "PART_TIME"
        | "NO_GUARANTEED_HOURS",
      fte: Number(formData.get("fte") ?? 1),
    };

    startTransition(async () => {
      setError(null);
      const result = initial
        ? await updateStaffProfileAction(initial.id, input)
        : await createStaffProfileAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone?.();
      router.refresh();
    });
  };

  const handleDeactivate = () => {
    if (!canWrite || !initial) return;

    startTransition(async () => {
      setError(null);
      const result = await deactivateStaffProfileAction(initial.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="staffCode">รหัสพนักงาน</Label>
          <Input
            id="staffCode"
            name="staffCode"
            defaultValue={initial?.staffCode ?? ""}
            required
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">ชื่อแสดง</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={initial?.displayName ?? ""}
            required
            disabled={!canWrite || pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initial?.email ?? ""}
          disabled={!canWrite || pending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="staffGradeId">ระดับพนักงาน</Label>
          <NativeSelect
            id="staffGradeId"
            name="staffGradeId"
            defaultValue={initial?.staffGradeId ?? ""}
            required
            disabled={!canWrite || pending}
          >
            <option value="">— เลือก —</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.code} — {grade.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="staffGroupId">กลุ่ม (canvas)</Label>
          <NativeSelect
            id="staffGroupId"
            name="staffGroupId"
            defaultValue={initial?.staffGroupId ?? ""}
            required
            disabled={!canWrite || pending}
          >
            <option value="">— เลือก —</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.code} — {group.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="staffGroupSection">หมวดย่อยในกลุ่ม</Label>
        <NativeSelect
          id="staffGroupSection"
          name="staffGroupSection"
          defaultValue={initial?.staffGroupSection ?? "RESULT_CAPABLE"}
          required
          disabled={!canWrite || pending}
        >
          {(Object.entries(STAFF_GROUP_SECTION_LABELS) as [StaffGroupSection, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </NativeSelect>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contractType">ประเภทสัญญา</Label>
          <NativeSelect
            id="contractType"
            name="contractType"
            defaultValue={initial?.contractType ?? "FULL_TIME"}
            disabled={!canWrite || pending}
          >
            {(Object.entries(CONTRACT_TYPE_LABELS) as [
              "FULL_TIME" | "PART_TIME" | "NO_GUARANTEED_HOURS",
              string,
            ][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fte">FTE</Label>
          <Input
            id="fte"
            name="fte"
            type="number"
            min={0}
            max={2}
            step={0.1}
            defaultValue={initial?.fte ?? 1}
            disabled={!canWrite || pending}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
          disabled={!canWrite || pending}
        />
        ใช้งาน
      </label>

      <AdvancedSection defaultOpen={Boolean(initial && initial.rowOrder !== 0)}>
        <div className="space-y-2">
          <Label htmlFor="rowOrder">ลำดับแถวในกลุ่ม</Label>
          <Input
            id="rowOrder"
            name="rowOrder"
            type="number"
            min={0}
            defaultValue={initial?.rowOrder ?? 0}
            disabled={!canWrite || pending}
          />
        </div>
      </AdvancedSection>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canWrite ? (
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : initial ? "บันทึกการแก้ไข" : "เพิ่มบุคลากร"}
          </Button>
        ) : null}
        {canWrite && initial?.active ? (
          <Button type="button" variant="outline" disabled={pending} onClick={handleDeactivate}>
            ปิดใช้งาน
          </Button>
        ) : null}
      </div>
    </form>
  );
}
