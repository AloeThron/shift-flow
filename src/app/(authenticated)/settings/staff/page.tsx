import { listStaffShiftAuthorizationsByOrgAction } from "@/actions/config/shift-authorization";
import { listShiftCodesAction } from "@/actions/config/shift-codes";
import {
  listStaffGradesForStaffAction,
  listStaffGroupsForStaffAction,
  listStaffProfilesAction,
} from "@/actions/config/staff";
import { ConfigPageHeader } from "@/components/config/config-page-header";
import { StaffSettingsPanel } from "@/components/config/staff-settings-panel";
import { getConfigWriteAccess } from "@/lib/auth/config-access";

/** หน้าจัดการบุคลากร */
export default async function StaffSettingsPage() {
  const { canWrite } = await getConfigWriteAccess();
  const [staffProfiles, grades, groups, shiftCodeRows, authorizations] = await Promise.all([
    listStaffProfilesAction(),
    listStaffGradesForStaffAction(),
    listStaffGroupsForStaffAction(),
    listShiftCodesAction(),
    listStaffShiftAuthorizationsByOrgAction(),
  ]);

  const shiftCodes = shiftCodeRows
    .filter((row) => !row.deprecated)
    .map((row) => ({
      id: row.id,
      code: row.canonicalCode,
      departmentCode: row.department?.code ?? null,
    }));

  return (
    <div className="space-y-6">
      <ConfigPageHeader
        title="บุคลากร"
        description="จัดการรายชื่อ กลุ่ม canvas หมวดย่อย และสิทธิปฏิบัติงานตามรหัสเวร"
      />

      <StaffSettingsPanel
        staffProfiles={staffProfiles}
        grades={grades}
        groups={groups}
        shiftCodes={shiftCodes}
        authorizations={authorizations}
        canWrite={canWrite}
      />
    </div>
  );
}
