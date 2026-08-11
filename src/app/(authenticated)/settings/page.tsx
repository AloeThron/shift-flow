import Link from "next/link";

import { listStarterPacksAction } from "@/actions/onboarding/starter-packs";
import { AdvancedSection } from "@/components/config/advanced-section";
import { ConfigPageHeader } from "@/components/config/config-page-header";
import { StarterPackApplyPanel } from "@/components/config/starter-pack-apply-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getConfigWriteAccess } from "@/lib/auth/config-access";
import { createScopedRepository } from "@/lib/db/scoped-repository";
import { prisma } from "@/lib/prisma";

/** หน้าภาพรวมการตั้งค่า */
export default async function SettingsOverviewPage() {
  const { ctx, canWrite } = await getConfigWriteAccess();
  const repo = createScopedRepository(ctx, prisma);
  const packsResult = await listStarterPacksAction();
  const packs = packsResult.ok ? packsResult.data : [];

  const [departmentCount, shiftCodeCount, demandCount, ruleCount, staffCount] = await Promise.all([
    repo.department.findMany().then((items) => items.length),
    repo.shiftCode.findMany().then((items) => items.length),
    repo.shiftCodeDemand.findMany().then((items) => items.length),
    repo.ruleInstance.findMany().then((items) => items.length),
    repo.staffProfile.findMany().then((items) => items.length),
  ]);

  const cards = [
    {
      href: "/settings/staff",
      title: "บุคลากร",
      description: "รายชื่อ กลุ่ม canvas หมวดย่อย และสิทธิปฏิบัติงานตามรหัสเวร",
      count: staffCount,
    },
    {
      href: "/settings/shift-codes",
      title: "รหัสเวร",
      description: "รหัสเวร แผนก และกำลังคนขั้นต่ำ — แก้ไขผ่าน dialog 3 แท็บ",
      count: shiftCodeCount,
    },
    {
      href: "/settings/shift-codes",
      title: "แผนก",
      description: "จุดปฏิบัติงานที่ผูกกับรหัสเวร — จัดการใน dialog แท็บแผนก",
      count: departmentCount,
    },
    {
      href: "/settings/shift-codes",
      title: "กำลังคนขั้นต่ำ",
      description: "ความต้องการกำลังคนต่อรหัสเวร — จัดการใน dialog แท็บกำลังคนขั้นต่ำ",
      count: demandCount,
    },
    {
      href: "/settings/rules",
      title: "กติกาเวร",
      description: "เปิด-ปิดกติกาและปรับค่าให้เหมาะกับหน่วยงาน",
      count: ruleCount,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <ConfigPageHeader
        title="ภาพรวมการตั้งค่า"
        description="ค่าเหล่านี้ตั้งแยกตามหน่วยงาน — ไม่ฝังตายในโปรแกรม"
      />

      {!canWrite ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-4 py-3 text-sm">
          ดูได้อย่างเดียว — การแก้ไขต้องใช้บัญชีผู้ดูแลระบบ
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardHeader>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{card.count}</p>
                <p className="text-muted-foreground text-xs">รายการในองค์กร</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <AdvancedSection
        title="ขั้นสูง"
        description="นำเข้าชุดตัวอย่างเริ่มต้นใหม่ — ใช้เมื่อต้องการล้างแล้วใส่ค่าตั้งต้นใหม่"
      >
        {!packsResult.ok ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {packsResult.error}
          </p>
        ) : (
          <StarterPackApplyPanel packs={packs} canWrite={canWrite} />
        )}
      </AdvancedSection>
    </div>
  );
}
