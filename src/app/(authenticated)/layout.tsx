import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { ContentWidthProvider } from "@/components/layout/content-width-provider";
import { hasPermission } from "@/domain/rbac/check-permission";
import { auth } from "@/lib/auth";
import { getOrganizationContext } from "@/lib/auth/get-organization-context";

/** layout สำหรับ route ที่ต้อง login */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const ctx = await getOrganizationContext();
  if (!ctx) {
    redirect("/login");
  }

  const canReadSchedule = hasPermission(ctx, "schedule:read");
  const canReadConfig = hasPermission(ctx, "org:config:read");

  return (
    <ContentWidthProvider>
      <div className="bg-background min-h-screen">
        <AppHeader
          username={session.user.username}
          canReadSchedule={canReadSchedule}
          canReadConfig={canReadConfig}
        />
        <main>{children}</main>
      </div>
    </ContentWidthProvider>
  );
}
