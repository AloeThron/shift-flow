import { listRuleInstancesAction } from "@/actions/config/rules";
import { ConfigPageHeader } from "@/components/config/config-page-header";
import { RulesSettingsPanel } from "@/components/config/rules-settings-panel";
import { getConfigWriteAccess } from "@/lib/auth/config-access";

/** หน้าจัดการ rule pack (rule instances) */
export default async function RulesSettingsPage() {
  const { canWrite } = await getConfigWriteAccess();
  const rules = await listRuleInstancesAction();

  return (
    <div className="space-y-6">
      <ConfigPageHeader
        title="กติกาเวร"
        description="เปิด-ปิดกติกา และปรับค่าให้เหมาะกับหน่วยงาน"
      />

      <RulesSettingsPanel rules={rules} canWrite={canWrite} />
    </div>
  );
}
