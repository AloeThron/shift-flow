"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createShiftCodeDemandAction,
  deleteShiftCodeDemandAction,
  updateShiftCodeDemandAction,
} from "@/actions/config/shift-codes";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateInput } from "@/domain/config/schemas";
import { labelsToWeekdayMask } from "@/domain/config/types";

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

const WEEKDAYS = [
  { index: 0, label: "จ" },
  { index: 1, label: "อ" },
  { index: 2, label: "พ" },
  { index: 3, label: "พฤ" },
  { index: 4, label: "ศ" },
  { index: 5, label: "ส" },
  { index: 6, label: "อา" },
] as const;

type ShiftCodeDemandPanelProps = {
  shiftCodeId: string;
  canonicalCode: string;
  demands: readonly DemandRow[];
  canWrite: boolean;
};

/** ฟอร์ม demand ย่อย */
function DemandForm({
  shiftCodeId,
  canWrite,
  initial,
  onDone,
}: {
  shiftCodeId: string;
  canWrite: boolean;
  initial?: DemandRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultWeekdays = initial
    ? WEEKDAYS.filter((day) => (initial.weekdayMask & (1 << day.index)) !== 0).map(
      (day) => day.index,
    )
    : [0, 1, 2, 3, 4];

  const handleSubmit = (formData: FormData) => {
    if (!canWrite) return;

    const selectedDays = WEEKDAYS.filter(
      (day) => formData.get(`weekday-${day.index}`) === "on",
    ).map((day) => day.index);

    const input = {
      shiftCodeId,
      name: String(formData.get("name") ?? ""),
      minHeadcount: Number(formData.get("minHeadcount") ?? 1),
      requiresLead: formData.get("requiresLead") === "on",
      weekdayMask: labelsToWeekdayMask(selectedDays),
      appliesOnHolidays: formData.get("appliesOnHolidays") === "on",
      effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
      effectiveTo: String(formData.get("effectiveTo") ?? "") || undefined,
      active: formData.get("active") === "on",
    };

    startTransition(async () => {
      setError(null);
      const result = initial
        ? await updateShiftCodeDemandAction(initial.id, input)
        : await createShiftCodeDemandAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone();
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!canWrite || !initial) return;
    if (!window.confirm(`ลบ demand "${initial.name}"?`)) return;

    startTransition(async () => {
      setError(null);
      const result = await deleteShiftCodeDemandAction(initial.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone();
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`name-${initial?.id ?? "new"}`}>ชื่อ</Label>
          <Input
            id={`name-${initial?.id ?? "new"}`}
            name="name"
            defaultValue={initial?.name ?? ""}
            required
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`minHeadcount-${initial?.id ?? "new"}`}>จำนวนขั้นต่ำ</Label>
          <Input
            id={`minHeadcount-${initial?.id ?? "new"}`}
            name="minHeadcount"
            type="number"
            min={1}
            defaultValue={initial?.minHeadcount ?? 1}
            required
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`effectiveFrom-${initial?.id ?? "new"}`}>มีผลตั้งแต่</Label>
          <DatePicker
            id={`effectiveFrom-${initial?.id ?? "new"}`}
            name="effectiveFrom"
            defaultValue={
              initial ? formatDateInput(initial.effectiveFrom) : formatDateInput(new Date())
            }
            required
            disabled={!canWrite || pending}
          />
        </div>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-xs font-medium">วันในสัปดาห์</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label key={day.index} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                name={`weekday-${day.index}`}
                defaultChecked={defaultWeekdays.includes(day.index)}
                disabled={!canWrite || pending}
              />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            name="requiresLead"
            defaultChecked={initial?.requiresLead ?? false}
            disabled={!canWrite || pending}
          />
          ต้องมีหัวหน้าเวร
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            name="appliesOnHolidays"
            defaultChecked={initial?.appliesOnHolidays ?? false}
            disabled={!canWrite || pending}
          />
          ใช้ในวันหยุด
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            disabled={!canWrite || pending}
          />
          ใช้งาน
        </label>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "กำลังบันทึก..." : initial ? "บันทึก demand" : "เพิ่ม demand"}
          </Button>
          {!initial ? (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onDone}>
              ยกเลิก
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              ลบ demand
            </Button>
          )}
        </div>
      ) : null}
    </form>
  );
}

/** panel จัดการ demand ต่อรหัสเวร */
export function ShiftCodeDemandPanel({
  shiftCodeId,
  canonicalCode,
  demands,
  canWrite,
}: ShiftCodeDemandPanelProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        ความต้องการกำลังคนขั้นต่ำของรหัส {canonicalCode} — ใช้เวลาจากรหัสเวร
      </p>

      {demands.map((demand) => (
        <DemandForm
          key={demand.id}
          shiftCodeId={shiftCodeId}
          canWrite={canWrite}
          initial={demand}
          onDone={() => undefined}
        />
      ))}

      {showCreate ? (
        <DemandForm
          shiftCodeId={shiftCodeId}
          canWrite={canWrite}
          onDone={() => setShowCreate(false)}
        />
      ) : canWrite ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          เพิ่ม demand
        </Button>
      ) : null}
    </div>
  );
}
