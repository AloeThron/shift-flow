import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedBanner } from "@/components/auth/access-denied-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/domain/rbac/check-permission";
import { auth } from "@/lib/auth";
import { getOrganizationContext } from "@/lib/auth/get-organization-context";
import { landingPathForContext } from "@/lib/auth/landing-path";

type HomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

/** หน้าแรก — สถานะ scaffold และ session */
export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const session = await auth();
  const ctx = session?.user ? await getOrganizationContext() : null;

  if (ctx && params.error && landingPathForContext(ctx) !== "/") {
    redirect(`${landingPathForContext(ctx)}?error=${params.error}`);
  }

  const canReadConfig = ctx ? hasPermission(ctx, "org:config:read") : false;
  const canReadSchedule = ctx ? hasPermission(ctx, "schedule:read") : false;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>Shift-Flow</h1>
          </CardTitle>
          <CardDescription>
            แพลตฟอร์มจัดตารางเวรห้องปฏิบัติการ — config-driven policy engine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AccessDeniedBanner error={params.error} />

          {session?.user ? (
            <div className="space-y-2 text-sm">
              <p>
                เข้าสู่ระบบแล้ว: <strong>{session.user.username}</strong>
              </p>
              {session.user.role ? (
                <p>
                  บทบาท: <strong>{session.user.role}</strong>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              ยังไม่ได้เข้าสู่ระบบ — บัญชีถูกสร้างโดยผู้ดูแลระบบเท่านั้น
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {session?.user ? (
              <>
                {canReadSchedule ? (
                  <Button asChild>
                    <Link href="/schedule">จัดเวร</Link>
                  </Button>
                ) : null}
                {canReadConfig ? (
                  <Button asChild variant={canReadSchedule ? "outline" : "default"}>
                    <Link href="/settings">ตั้งค่าองค์กร</Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link href="/signout">ออกจากระบบ</Link>
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link href="/login">เข้าสู่ระบบ</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
