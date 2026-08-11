"use client";

import {
  LayoutDashboard,
  ShieldCheck,
  Tags,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** รายการเมนูตั้งค่าองค์กร */
const SETTINGS_NAV: readonly {
  href: string;
  label: string;
  exact?: boolean;
  icon: LucideIcon;
}[] = [
    { href: "/settings", label: "ภาพรวม", exact: true, icon: LayoutDashboard },
    { href: "/settings/staff", label: "บุคลากร", icon: UserCog },
    { href: "/settings/shift-codes", label: "รหัสเวร", icon: Tags },
    { href: "/settings/rules", label: "กติกาเวร", icon: ShieldCheck },
  ];

/** เมนูนำทางหน้าตั้งค่า */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูตั้งค่าองค์กร" className="flex flex-col gap-1">
      {SETTINGS_NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
