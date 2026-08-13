"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, type ToggleEvent, useState } from "react";

import { cn } from "@/lib/utils";

type AdvancedSectionProps = {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/** ส่วนย่อสำหรับฟิลด์หรือการตั้งค่าที่ใช้น้อย — ใช้ details/summary แทน Radix เพื่อหลีกเลี่ยง hydration mismatch */
export function AdvancedSection({
  title = "ตัวเลือกเพิ่มเติม",
  description,
  defaultOpen = false,
  children,
  className,
}: AdvancedSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = (event: ToggleEvent<HTMLDetailsElement>) => {
    setOpen(event.currentTarget.open);
  };

  return (
    <details open={open} onToggle={handleToggle} className={cn("group", className)}>
      <summary className="text-muted-foreground hover:text-foreground flex w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-foreground font-medium">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs font-normal">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}
