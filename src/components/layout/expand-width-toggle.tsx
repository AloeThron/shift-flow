"use client";

import { Maximize2, Minimize2 } from "lucide-react";

import { useContentWidth } from "@/components/layout/content-width-provider";
import { Button } from "@/components/ui/button";

/** ปุ่มสลับครอบ container / ขยายเต็มจอ */
export function ExpandWidthToggle() {
  const { expanded, toggleExpanded } = useContentWidth();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleExpanded}
      aria-pressed={expanded}
      aria-label={expanded ? "ย่อกลับเข้า container" : "ขยายเต็มจอ"}
      title={expanded ? "ย่อกลับเข้า container" : "ขยายเต็มจอ"}
    >
      {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      <span className="hidden sm:inline">{expanded ? "ย่อ" : "ขยายเต็มจอ"}</span>
    </Button>
  );
}
