"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  SCHEDULE_STEPS,
  type ScheduleStepId,
  type ScheduleStepState,
} from "./schedule-steps";

/** แถบขั้นตอนจัดตาราง — สลับได้อิสระ พร้อม hint และแถว actions */
export function ScheduleStepBar({
  activeStep,
  stepStates,
  onStepChange,
  actions,
}: {
  activeStep: ScheduleStepId;
  stepStates: readonly ScheduleStepState[];
  onStepChange: (step: ScheduleStepId) => void;
  actions?: ReactNode;
}) {
  const currentStep = SCHEDULE_STEPS.find((step) => step.id === activeStep);
  const doneById = new Map(stepStates.map((state) => [state.id, state.isDone]));

  return (
    <div className="space-y-2">
      <nav aria-label="ขั้นตอนจัดตาราง">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {SCHEDULE_STEPS.map((step, index) => {
            const isActive = step.id === activeStep;
            const isDone = doneById.get(step.id) ?? false;

            return (
              <li key={step.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background hover:bg-muted/50 text-muted-foreground",
                  )}
                  onClick={() => onStepChange(step.id)}
                >
                  <span
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="whitespace-nowrap">{step.labelTh}</span>
                  {isDone ? (
                    <Check className="text-primary size-3.5 shrink-0" aria-label="เสร็จแล้ว" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {currentStep ? (
        <p className="text-muted-foreground text-sm">{currentStep.hintTh}</p>
      ) : null}

      {actions}
    </div>
  );
}
