import { SEVERITY_LABELS } from "@/components/config/ui-labels";
import type { ConfigEffectiveStatus } from "@/domain/config/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ConfigEffectiveStatus, string> = {
  active: "มีผล",
  pending: "รอมีผล",
  expired: "หมดอายุ",
};

const STATUS_STYLES: Record<ConfigEffectiveStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  expired: "bg-muted text-muted-foreground",
};

/** แสดงสถานะ effective ของ config */
export function EffectiveStatusBadge({
  status,
  className,
}: {
  status: ConfigEffectiveStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** badge สถานะ active/inactive */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "ใช้งาน" : "ปิด"}
    </span>
  );
}

/** badge ระดับความเข้มของกติกา */
export function SeverityBadge({ severity }: { severity: "HARD" | "SOFT" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        severity === "HARD" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800",
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
