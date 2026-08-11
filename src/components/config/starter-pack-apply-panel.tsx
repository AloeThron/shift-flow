"use client";

import { useMemo, useState, useTransition } from "react";

import { applyStarterPackAction } from "@/actions/onboarding/starter-packs";
import { formatComplexityLabel } from "@/components/config/ui-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_PACK_ID = "pilot-lab-example";

/** ข้อความเตือนภาษาไทยของชุดตัวอย่าง */
const PACK_NOTICE_TH: Record<string, string> = {
  [DEFAULT_PACK_ID]: "ข้อมูลตัวอย่างรูปแบบซับซ้อน — ต้องตรวจและปรับให้ตรงหน่วยงานก่อนใช้จริง",
};

/** ข้อมูล pack สำหรับแสดงใน UI */
export type StarterPackCardData = {
  id: string;
  displayNameTh: string;
  displayNameEn: string;
  complexity: string;
  disclaimer: string;
  requiresReview?: boolean;
};

type StarterPackApplyPanelProps = {
  packs: readonly StarterPackCardData[];
  canWrite: boolean;
};

/** แผงนำเข้าชุดตัวอย่าง — Pilot Pattern Laboratory */
export function StarterPackApplyPanel({ packs, canWrite }: StarterPackApplyPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultPack = useMemo(
    () => packs.find((pack) => pack.id === DEFAULT_PACK_ID) ?? packs[0],
    [packs],
  );

  const handleApply = (packId: string) => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await applyStarterPackAction({
        packId,
        includeStaff: true,
        includeHolidays: true,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(
        `นำเข้าสำเร็จ — แผนก ${result.data.departments} รายการ, รหัสเวร ${result.data.shiftCodes}, demand ${result.data.shiftCodeDemands}, พนักงานตัวอย่าง ${result.data.staffProfiles}, กติกา ${result.data.ruleInstances}, เซลล์ตารางเวร ${result.data.rosterAssignments} — ดูได้ที่ /schedule`,
      );
    });
  };

  if (!defaultPack) {
    return <p className="text-muted-foreground text-sm">ไม่พบชุดตัวอย่างเริ่มต้นในรายการ</p>;
  }

  return (
    <div className="space-y-4">
      {!canWrite ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-4 py-3 text-sm">
          ดูได้อย่างเดียว — การนำเข้าชุดตัวอย่างต้องใช้บัญชีผู้ดูแลระบบ
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm">
        การนำเข้าจะแทนที่การตั้งค่าองค์กร (พื้นที่ปฏิบัติงาน รหัสเวร กำลังคนขั้นต่ำ กติกา
        และพนักงานตัวอย่าง) แล้วสร้างตารางเวรเดือนตัวอย่างให้ดูที่หน้าเวร — ตารางเดิม /
        ร่างที่มีอยู่จะถูกล้าง
      </p>

      {message ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{defaultPack.displayNameTh}</CardTitle>
          <CardDescription>{defaultPack.displayNameEn}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs">
            ความซับซ้อน: {formatComplexityLabel(defaultPack.complexity)}
            {defaultPack.requiresReview ? " — ต้องตรวจก่อนใช้จริง" : ""}
          </p>
          <p className="text-xs">
            {PACK_NOTICE_TH[defaultPack.id] ?? "ข้อมูลตัวอย่าง — ปรับค่าให้ตรงหน่วยงานก่อนใช้จริง"}
          </p>
          <Button
            type="button"
            disabled={!canWrite || pending}
            onClick={() => handleApply(defaultPack.id)}
          >
            {pending ? "กำลังนำเข้า…" : "นำเข้าชุดตัวอย่าง"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
