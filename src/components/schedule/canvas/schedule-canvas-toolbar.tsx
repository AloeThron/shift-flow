"use client";

import { Eye, EyeOff, Scale, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NonWorkingDayKindOption } from "@/lib/scheduling/load-canvas-draft";

import type { ScheduleStepId } from "./schedule-steps";

/** แถบเครื่องมือ canvas — ปุ่มตามขั้นตอนที่เลือก */
export function ScheduleCanvasToolbar({
  activeStep,
  canWrite,
  showPaintOffControls,
  onRunDayOffSolver,
  onRunBalanceSolver,
  publishActions,
  busy,
  showEmptySections,
  onToggleShowEmptySections,
  nonWorkingDayKinds,
  paintKindId,
  onPaintKindChange,
}: {
  activeStep: ScheduleStepId;
  canWrite: boolean;
  showPaintOffControls: boolean;
  onRunDayOffSolver: () => void;
  onRunBalanceSolver: () => void;
  publishActions?: ReactNode;
  busy: boolean;
  showEmptySections: boolean;
  onToggleShowEmptySections: () => void;
  nonWorkingDayKinds: readonly NonWorkingDayKindOption[];
  paintKindId: string | null;
  onPaintKindChange: (kindId: string) => void;
}) {
  if (!canWrite) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">โหมดดูอย่างเดียว — ไม่มีสิทธิ์แก้ draft</p>
        {activeStep === "TIDY" ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="ตัวเลือกการแสดงผล">
            <Button
              type="button"
              size="sm"
              variant={showEmptySections ? "secondary" : "outline"}
              onClick={onToggleShowEmptySections}
              aria-pressed={showEmptySections}
            >
              {showEmptySections ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              {showEmptySections ? "ซ่อนหมวดว่าง" : "แสดงหมวดว่าง"}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeStep === "TIDY") {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="ตัวเลือกการแสดงผล">
        <Button
          type="button"
          size="sm"
          variant={showEmptySections ? "secondary" : "outline"}
          onClick={onToggleShowEmptySections}
          aria-pressed={showEmptySections}
        >
          {showEmptySections ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
          {showEmptySections ? "ซ่อนหมวดว่าง" : "แสดงหมวดว่าง"}
        </Button>
      </div>
    );
  }

  if (showPaintOffControls) {
    const selectId = "canvas-paint-off-kind";

    return (
      <div className="flex flex-wrap items-center gap-3" role="group" aria-label="ชนิดวันหยุดที่จะลง">
        <div className="flex items-center gap-2">
          <Label htmlFor={selectId} className="text-sm whitespace-nowrap">
            ชนิดวันหยุด
          </Label>
          <Select
            value={paintKindId ?? undefined}
            onValueChange={onPaintKindChange}
            disabled={nonWorkingDayKinds.length === 0}
          >
            <SelectTrigger id={selectId} size="sm" className="min-w-[10rem]">
              <SelectValue placeholder="เลือกชนิดวันหยุด" />
            </SelectTrigger>
            <SelectContent>
              {nonWorkingDayKinds.map((kind) => (
                <SelectItem key={kind.id} value={kind.id}>
                  {kind.displayName} ({kind.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {activeStep === "AUTO_OFF" ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRunDayOffSolver}>
            <Sparkles aria-hidden />
            เกลียววันหยุด auto
          </Button>
        ) : null}
      </div>
    );
  }

  if (activeStep === "AUTO_OFF") {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Solver วันหยุด">
        <Button type="button" size="sm" variant="default" disabled={busy} onClick={onRunDayOffSolver}>
          <Sparkles aria-hidden />
          เกลียววันหยุด
        </Button>
      </div>
    );
  }

  if (activeStep === "AUTO_BALANCE") {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Solver เกลี่ยงาน">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={busy}
          onClick={onRunBalanceSolver}
        >
          <Scale aria-hidden />
          เกลี่ยงาน
        </Button>
      </div>
    );
  }

  if (activeStep === "FREE_EDIT") {
    return (
      <p className="text-muted-foreground text-sm">
        คลิกเซลล์เพื่อเปิด popup แก้รหัสเวร — ตรวจ hard rule และ coverage ในแผงสถานะด้านล่าง
      </p>
    );
  }

  if (activeStep === "PUBLISH") {
    return publishActions ? (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="เผยแพร่และแชร์">
        {publishActions}
      </div>
    ) : null;
  }

  return null;
}
