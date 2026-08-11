"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { StaffShiftAuthorizationView } from "@/actions/config/shift-authorization";
import {
  clearStaffShiftAuthorizationsAction,
  syncStaffShiftAuthorizationsAction,
} from "@/actions/config/shift-authorization";
import { AdvancedSection } from "@/components/config/advanced-section";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateInput } from "@/domain/config/schemas";
import { cn } from "@/lib/utils";

type ShiftCodeOption = {
  id: string;
  code: string;
  departmentCode: string | null;
};

type StaffOption = {
  id: string;
  staffCode: string;
  displayName: string;
};

type StaffShiftAuthPanelProps = {
  staffProfileId: string;
  staffDisplayName: string;
  authorizations: readonly StaffShiftAuthorizationView[];
  shiftCodes: readonly ShiftCodeOption[];
  staffOptions: readonly StaffOption[];
  canWrite: boolean;
};

/** สร้าง state เริ่มต้นจาก authorization ที่มีอยู่ */
function deriveInitialState(authorizations: readonly StaffShiftAuthorizationView[]) {
  const coversAllAuth = authorizations.find((item) => item.coversAllShiftCodes);
  const individualAuths = authorizations.filter(
    (item) => !item.coversAllShiftCodes && item.shiftCodeId,
  );
  const reference = coversAllAuth ?? individualAuths[0];

  return {
    coversAll: Boolean(coversAllAuth),
    selectedIds: new Set(individualAuths.map((item) => item.shiftCodeId as string)),
    assessedAt: reference ? formatDateInput(new Date(reference.assessedAt)) : formatDateInput(new Date()),
    expiresAt: reference?.expiresAt ? formatDateInput(new Date(reference.expiresAt)) : "",
    level: reference?.level ?? "",
    authorizedByStaffId: reference?.authorizedByStaffId ?? "",
  };
}

/** จัดกลุ่มรหัสเวรตามแผนก */
function groupShiftCodes(shiftCodes: readonly ShiftCodeOption[]) {
  const groups = new Map<string, ShiftCodeOption[]>();
  for (const code of shiftCodes) {
    const key = code.departmentCode ?? "—";
    const list = groups.get(key) ?? [];
    list.push(code);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

/** panel จัดการสิทธิปฏิบัติงานของบุคลากร — checkbox รหัสเวร */
export function StaffShiftAuthPanel({
  staffProfileId,
  staffDisplayName,
  authorizations,
  shiftCodes,
  staffOptions,
  canWrite,
}: StaffShiftAuthPanelProps) {
  const router = useRouter();
  const initial = useMemo(() => deriveInitialState(authorizations), [authorizations]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [coversAll, setCoversAll] = useState(initial.coversAll);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initial.selectedIds);
  const groupedCodes = useMemo(() => groupShiftCodes(shiftCodes), [shiftCodes]);

  useEffect(() => {
    const next = deriveInitialState(authorizations);
    setCoversAll(next.coversAll);
    setSelectedIds(next.selectedIds);
  }, [authorizations]);

  const toggleShiftCode = (shiftCodeId: string) => {
    if (!canWrite || pending || coversAll) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(shiftCodeId)) {
        next.delete(shiftCodeId);
      } else {
        next.add(shiftCodeId);
      }
      return next;
    });
  };

  const toggleCoversAll = () => {
    if (!canWrite || pending) {
      return;
    }

    setCoversAll((current) => {
      const next = !current;
      if (next) {
        setSelectedIds(new Set());
      }
      return next;
    });
  };

  const handleSubmit = (formData: FormData) => {
    if (!canWrite) {
      return;
    }

    const input = {
      coversAll,
      shiftCodeIds: [...selectedIds],
      assessedAt: String(formData.get("assessedAt") ?? ""),
      expiresAt: String(formData.get("expiresAt") ?? "") || undefined,
      level: String(formData.get("level") ?? "") || undefined,
      authorizedByStaffId: String(formData.get("authorizedByStaffId") ?? "") || undefined,
    };

    startTransition(async () => {
      setError(null);
      const result = await syncStaffShiftAuthorizationsAction(staffProfileId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  };

  const handleClear = () => {
    if (!canWrite || pending) {
      return;
    }
    if (!window.confirm("ล้างสิทธิปฏิบัติงานทั้งหมดของบุคลากรนี้?")) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await clearStaffShiftAuthorizationsAction(staffProfileId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCoversAll(false);
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const hasSelection = coversAll || selectedIds.size > 0;

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">สิทธิ์ปฏิบัติงาน</h3>
        <p className="text-muted-foreground text-xs">
          เลือกรหัสเวรที่ {staffDisplayName} ได้รับอนุมัติ — ใช้กรอง eligibility ใน Stage B
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4 rounded-md border p-3">
        <fieldset className="space-y-2" disabled={!canWrite || pending}>
          <legend className="text-sm font-medium">รหัสเวรที่ได้รับอนุมัติ</legend>

          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
              coversAll && "border-primary bg-primary/5",
            )}
          >
            <input
              type="checkbox"
              checked={coversAll}
              onChange={toggleCoversAll}
              disabled={!canWrite || pending}
            />
            <span className="font-medium">ทุกรหัสเวร</span>
          </label>

          {shiftCodes.length === 0 ? (
            <p className="text-muted-foreground text-sm">ยังไม่มีรหัสเวรที่ใช้งาน</p>
          ) : (
            groupedCodes.map(([departmentCode, codes]) => (
              <div key={departmentCode} className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">
                  แผนก {departmentCode}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {codes.map((item) => {
                    const checked = coversAll || selectedIds.has(item.id);
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                          checked && !coversAll && "border-primary/40 bg-primary/5",
                          coversAll && "opacity-60",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleShiftCode(item.id)}
                          disabled={!canWrite || pending || coversAll}
                        />
                        <span className="font-mono">{item.code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`assessed-${staffProfileId}`}>วันอนุมัติ</Label>
            <DatePicker
              id={`assessed-${staffProfileId}`}
              name="assessedAt"
              defaultValue={initial.assessedAt}
              key={`assessed-${initial.assessedAt}`}
              required
              disabled={!canWrite || pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`expires-${staffProfileId}`}>วันหมดอายุ</Label>
            <DatePicker
              id={`expires-${staffProfileId}`}
              name="expiresAt"
              defaultValue={initial.expiresAt}
              key={`expires-${initial.expiresAt}`}
              allowClear
              disabled={!canWrite || pending}
            />
            <p className="text-muted-foreground text-xs">เว้นว่าง = ไม่หมดอายุ</p>
          </div>
        </div>

        <AdvancedSection defaultOpen={Boolean(initial.authorizedByStaffId)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`level-${staffProfileId}`}>ระดับ (ถ้ามี)</Label>
              <Input
                id={`level-${staffProfileId}`}
                name="level"
                defaultValue={initial.level}
                key={`level-${initial.level}`}
                disabled={!canWrite || pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`authorizer-${staffProfileId}`}>ผู้อนุมัติ</Label>
              <NativeSelect
                id={`authorizer-${staffProfileId}`}
                name="authorizedByStaffId"
                defaultValue={initial.authorizedByStaffId}
                key={`authorizer-${initial.authorizedByStaffId}`}
                disabled={!canWrite || pending}
              >
                <option value="">— ไม่ระบุ —</option>
                {staffOptions
                  .filter((item) => item.id !== staffProfileId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.staffCode} — {item.displayName}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          </div>
        </AdvancedSection>

        {authorizations.some((item) => item.expiresAt === null) ? (
          <p className="text-muted-foreground text-xs">มีสิทธิที่ไม่หมดอายุ</p>
        ) : null}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}

        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || !hasSelection}>
              {pending ? "กำลังบันทึก..." : "บันทึกสิทธิปฏิบัติงาน"}
            </Button>
            {authorizations.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={handleClear}
              >
                ล้างสิทธิทั้งหมด
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
