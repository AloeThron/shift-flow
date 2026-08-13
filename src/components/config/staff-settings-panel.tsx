"use client";

import type { StaffShiftAuthorizationView } from "@/actions/config/shift-authorization";
import type { StaffProfileView } from "@/actions/config/staff";
import {
  ConfigResourcePanel,
  ConfigRowActionButton,
  ConfigTableCell,
} from "@/components/config/config-resource-panel";
import {
  CONFIG_TABLE_MIN_WIDTH,
  STAFF_TABLE_COLUMNS,
} from "@/components/config/config-table-layout";
import { StaffForm } from "@/components/config/staff-form";
import { StaffShiftAuthPanel } from "@/components/config/staff-shift-auth-panel";
import { ActiveBadge } from "@/components/config/status-badge";
import { STAFF_GROUP_SECTION_LABELS } from "@/components/config/ui-labels";

type GradeOption = { id: string; code: string; displayName: string };
type GroupOption = { id: string; code: string; displayName: string };
type ShiftCodeOption = { id: string; code: string; departmentCode: string | null };

type StaffSettingsPanelProps = {
  staffProfiles: StaffProfileView[];
  grades: GradeOption[];
  groups: GroupOption[];
  shiftCodes: readonly ShiftCodeOption[];
  authorizations: readonly (StaffShiftAuthorizationView & { staffProfileId: string })[];
  canWrite: boolean;
};

/** แสดงสรุปสิทธิรหัสเวรในแถวตาราง */
function ShiftAuthSummaryCell({ summary }: { summary: StaffProfileView["shiftAuthSummary"] }) {
  if (summary.coversAll) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs">ทั้งหมด</span>
        {summary.expiringSoon ? (
          <span
            className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800"
            title="สิทธิทุกรหัสเวรจะหมดอายุภายใน 30 วัน"
          >
            !
          </span>
        ) : null}
      </span>
    );
  }

  if (summary.validCount === 0) {
    return <span className="text-muted-foreground">0</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{summary.validCount}</span>
      {summary.expiringSoon ? (
        <span
          className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800"
          title="มีสิทธิที่จะหมดอายุภายใน 30 วัน"
        >
          !
        </span>
      ) : null}
    </span>
  );
}

/** panel ตาราง + การ์ดแก้ไขบุคลากร */
export function StaffSettingsPanel({
  staffProfiles,
  grades,
  groups,
  shiftCodes,
  authorizations,
  canWrite,
}: StaffSettingsPanelProps) {
  const byId = new Map(staffProfiles.map((profile) => [profile.id, profile]));
  const authorizationsByStaff = authorizations.reduce<Map<string, StaffShiftAuthorizationView[]>>(
    (map, row) => {
      const { staffProfileId, ...auth } = row;
      const list = map.get(staffProfileId) ?? [];
      list.push(auth);
      map.set(staffProfileId, list);
      return map;
    },
    new Map(),
  );

  const staffOptions = staffProfiles.map((profile) => ({
    id: profile.id,
    staffCode: profile.staffCode,
    displayName: profile.displayName,
  }));

  return (
    <ConfigResourcePanel
      canWrite={canWrite}
      tableTitle="รายการบุคลากร"
      itemCount={staffProfiles.length}
      createLabel="เพิ่มบุคลากร"
      createTitle="เพิ่มบุคลากรใหม่"
      minTableWidth={CONFIG_TABLE_MIN_WIDTH.staff}
      columns={STAFF_TABLE_COLUMNS}
      editorVariant="dialog"
      getEditTitle={(id) => byId.get(id)?.staffCode ?? id}
      renderRows={({ openEdit, isSelected, dialogOpen, canWrite: writeAccess }) =>
        staffProfiles.map((profile) => (
          <tr key={profile.id} className="border-b last:border-0">
            <ConfigTableCell>
              <span className="font-mono">{profile.staffCode}</span>
            </ConfigTableCell>
            <ConfigTableCell>
              <span className="leading-snug">{profile.displayName}</span>
            </ConfigTableCell>
            <ConfigTableCell>
              <span>{profile.staffGrade.code}</span>
            </ConfigTableCell>
            <ConfigTableCell>
              <span>{profile.staffGroup?.code ?? "—"}</span>
            </ConfigTableCell>
            <ConfigTableCell>
              <span className="text-xs leading-snug">
                {STAFF_GROUP_SECTION_LABELS[profile.staffGroupSection]}
              </span>
            </ConfigTableCell>
            <ConfigTableCell>
              <ShiftAuthSummaryCell summary={profile.shiftAuthSummary} />
            </ConfigTableCell>
            <ConfigTableCell>
              <span>{profile.rowOrder}</span>
            </ConfigTableCell>
            <ConfigTableCell>
              <ActiveBadge active={profile.active} />
            </ConfigTableCell>
            <ConfigTableCell>
              <ConfigRowActionButton
                canWrite={writeAccess}
                selected={isSelected(profile.id)}
                disabled={dialogOpen}
                onClick={() => openEdit(profile.id)}
              />
            </ConfigTableCell>
          </tr>
        ))
      }
      renderEditor={(mode, close) => {
        if (mode.type === "create") {
          return <StaffForm grades={grades} groups={groups} canWrite={canWrite} onDone={close} />;
        }

        const profile = byId.get(mode.id);
        if (!profile) {
          return <p className="text-muted-foreground text-sm">ไม่พบรายการ</p>;
        }

        const contract = profile.employmentContracts[0];

        return (
          <div className="space-y-2">
            <StaffForm
              grades={grades}
              groups={groups}
              canWrite={canWrite}
              onDone={close}
              initial={{
                id: profile.id,
                staffCode: profile.staffCode,
                displayName: profile.displayName,
                email: profile.email,
                staffGradeId: profile.staffGradeId,
                staffGroupId: profile.staffGroupId,
                staffGroupSection: profile.staffGroupSection,
                rowOrder: profile.rowOrder,
                active: profile.active,
                contractType: contract?.contractType ?? "FULL_TIME",
                fte: contract?.fte ?? 1,
              }}
            />
            <StaffShiftAuthPanel
              staffProfileId={profile.id}
              staffDisplayName={profile.displayName}
              authorizations={authorizationsByStaff.get(profile.id) ?? []}
              shiftCodes={shiftCodes}
              staffOptions={staffOptions}
              canWrite={canWrite}
            />
          </div>
        );
      }}
    />
  );
}
