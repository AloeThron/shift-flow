"use client";

import type { ReactNode } from "react";

import { useContentWidth } from "@/components/layout/content-width-provider";
import { cn } from "@/lib/utils";

const maxWidthClass = {
  lg: "max-w-lg",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

type PageContainerProps = {
  children: ReactNode;
  maxWidth?: keyof typeof maxWidthClass;
  className?: string;
};

/** ครอบเนื้อหาด้วย max-width — ปิดเมื่อโหมดขยายเต็มจอ */
export function PageContainer({ children, maxWidth = "6xl", className }: PageContainerProps) {
  const { expanded } = useContentWidth();

  return (
    <div className={cn("w-full", !expanded && ["mx-auto", maxWidthClass[maxWidth]], className)}>
      {children}
    </div>
  );
}
