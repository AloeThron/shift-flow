import { ConfigPageHeader } from "@/components/config/config-page-header";
import { SettingsNav } from "@/components/config/settings-nav";
import { PageContainer } from "@/components/layout/page-container";
import { requireConfigReadAccess } from "@/lib/auth/config-access";

/** layout หน้าตั้งค่าองค์กร */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireConfigReadAccess();

  return (
    <PageContainer maxWidth="6xl" className="grid gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
        <ConfigPageHeader title="ตั้งค่าองค์กร" description="จัดการนโยบายและรายการรหัสของหน่วยงาน" />
        <SettingsNav />
      </aside>
      <section className="min-w-0 space-y-6">{children}</section>
    </PageContainer>
  );
}
