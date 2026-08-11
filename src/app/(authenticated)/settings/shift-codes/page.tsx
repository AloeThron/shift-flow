import { listDepartmentsAction, listDepartmentsForSelectAction } from "@/actions/config/departments";
import {
  listShiftCodeDemandsAction,
  listShiftCodesAction,
  listStaffGradesAction,
} from "@/actions/config/shift-codes";
import { ConfigPageHeader } from "@/components/config/config-page-header";
import { ShiftCodesSettingsPanel } from "@/components/config/shift-codes-settings-panel";
import { getConfigWriteAccess } from "@/lib/auth/config-access";

/** หน้าจัดการ shift code + แผนก + demand */
export default async function ShiftCodesSettingsPage() {
  const { canWrite } = await getConfigWriteAccess();
  const [shiftCodes, departments, departmentRows, grades] = await Promise.all([
    listShiftCodesAction(),
    listDepartmentsForSelectAction(),
    listDepartmentsAction(),
    listStaffGradesAction(),
  ]);

  const demandEntries = await Promise.all(
    shiftCodes.map(async (code) => {
      const demands = await listShiftCodeDemandsAction(code.id);
      return [code.id, demands] as const;
    }),
  );
  const demandsByShiftCodeId = new Map(demandEntries);

  return (
    <div className="space-y-6">
      <ConfigPageHeader
        title="รหัสเวร"
        description="รายการรหัสเวร แผนก และกำลังคนขั้นต่ำ"
      />

      <ShiftCodesSettingsPanel
        shiftCodes={shiftCodes}
        departments={departments}
        departmentRows={departmentRows}
        demandsByShiftCodeId={demandsByShiftCodeId}
        grades={grades}
        canWrite={canWrite}
      />
    </div>
  );
}
