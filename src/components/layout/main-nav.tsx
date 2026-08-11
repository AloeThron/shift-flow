"use client";

import { BarChart3, PencilLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

export const MAIN_NAV_ITEMS: readonly {
  href: string;
  label: string;
  exact: boolean;
  icon: LucideIcon;
}[] = [
  { href: "/schedule", label: "จัดเวร", exact: false, icon: PencilLine },
  { href: "/schedule/workload", label: "ภาระงาน", exact: false, icon: BarChart3 },
];

/** ปุ่มเมนูหลักใน header */
export function MainNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {MAIN_NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Button key={item.href} asChild variant={active ? "secondary" : "ghost"} size="sm">
            <Link href={item.href}>
              <Icon aria-hidden />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </>
  );
}
