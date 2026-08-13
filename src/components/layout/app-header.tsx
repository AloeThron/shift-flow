"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ExpandWidthToggle } from "@/components/layout/expand-width-toggle";
import { MainNavLinks } from "@/components/layout/main-nav";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  username: string;
  canReadSchedule: boolean;
  canReadConfig: boolean;
};

/** header หลัก — เมนูเป็นปุ่มในแถวเดียว */
export function AppHeader({ username, canReadSchedule, canReadConfig }: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="border-b">
      <PageContainer maxWidth="6xl" className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="shrink-0 font-semibold">
            Shift-Flow
          </Link>
          <span className="text-muted-foreground truncate text-sm">{username}</span>
        </div>
        <nav aria-label="เมนูหลัก" className="flex flex-wrap items-center justify-end gap-1">
          {canReadSchedule ? <MainNavLinks /> : null}
          {canReadConfig ? (
            <Button
              asChild
              variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
              size="sm"
            >
              <Link href="/settings">
                <Settings aria-hidden />
                ตั้งค่าองค์กร
              </Link>
            </Button>
          ) : null}
          <ExpandWidthToggle />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/signout">
              <LogOut aria-hidden />
              ออกจากระบบ
            </Link>
          </Button>
        </nav>
      </PageContainer>
    </header>
  );
}
