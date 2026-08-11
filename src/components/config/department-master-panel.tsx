"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
} from "@/actions/config/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DepartmentRow = {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
  active: boolean;
};

type DepartmentMasterPanelProps = {
  departments: readonly DepartmentRow[];
  canWrite: boolean;
};

/** ฟอร์มย่อยสร้าง/แก้ไขแผนก */
function DepartmentSubForm({
  canWrite,
  initial,
  onDone,
}: {
  canWrite: boolean;
  initial?: DepartmentRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    if (!canWrite) return;

    const input = {
      code: String(formData.get("code") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      active: formData.get("active") === "on",
    };

    startTransition(async () => {
      setError(null);
      const result = initial
        ? await updateDepartmentAction(initial.id, input)
        : await createDepartmentAction(input);

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
    if (!window.confirm(`ลบแผนก ${initial.code}?`)) return;

    startTransition(async () => {
      setError(null);
      const result = await deleteDepartmentAction(initial.id);

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
          <Label htmlFor={`code-${initial?.id ?? "new"}`}>รหัส</Label>
          <Input
            id={`code-${initial?.id ?? "new"}`}
            name="code"
            defaultValue={initial?.code ?? ""}
            required
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`displayName-${initial?.id ?? "new"}`}>ชื่อ</Label>
          <Input
            id={`displayName-${initial?.id ?? "new"}`}
            name="displayName"
            defaultValue={initial?.displayName ?? ""}
            required
            disabled={!canWrite || pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sortOrder-${initial?.id ?? "new"}`}>ลำดับ</Label>
          <Input
            id={`sortOrder-${initial?.id ?? "new"}`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={initial?.sortOrder ?? 0}
            disabled={!canWrite || pending}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
          disabled={!canWrite || pending}
        />
        ใช้งาน
      </label>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "กำลังบันทึก..." : initial ? "บันทึกแผนก" : "เพิ่มแผนก"}
          </Button>
          {!initial ? (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onDone}>
              ยกเลิก
            </Button>
          ) : null}
          {initial ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              ลบ
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** panel จัดการ master แผนกใน header ตารางรหัสเวร */
export function DepartmentMasterPanel({ departments, canWrite }: DepartmentMasterPanelProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        จัดการรายการแผนก — ผูกแผนกกับรหัสเวรได้ในส่วนด้านบนของแท็บนี้
      </p>

      {departments.map((dept) => (
        <DepartmentSubForm
          key={dept.id}
          canWrite={canWrite}
          initial={dept}
          onDone={() => undefined}
        />
      ))}

      {showCreate ? (
        <DepartmentSubForm canWrite={canWrite} onDone={() => setShowCreate(false)} />
      ) : canWrite ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          เพิ่มแผนก
        </Button>
      ) : null}
    </div>
  );
}
