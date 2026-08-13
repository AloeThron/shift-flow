"use client";

import {
  ConfigResourcePanel,
  ConfigRowActionButton,
  ConfigTableCell,
} from "@/components/config/config-resource-panel";
import {
  CONFIG_TABLE_MIN_WIDTH,
  RULES_TABLE_COLUMNS,
} from "@/components/config/config-table-layout";
import { RuleInstanceForm } from "@/components/config/rule-instance-form";
import { RuleToggleButton } from "@/components/config/rule-toggle-button";
import { EffectiveStatusBadge, SeverityBadge } from "@/components/config/status-badge";
import { OVERRIDE_CLASS_LABELS } from "@/components/config/ui-labels";
import { formatDateInput } from "@/domain/config/schemas";
import { getEffectiveStatus } from "@/domain/config/types";
import { getRuleTemplate } from "@/domain/rules/registry";
import type { OverrideClass, RuleSeverity } from "@/generated/client/client";

type RuleRow = {
  id: string;
  ruleTemplateId: string;
  params: unknown;
  severity: RuleSeverity;
  weight: number | null;
  overrideClass: OverrideClass;
  enabled: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

type RulesSettingsPanelProps = {
  rules: RuleRow[];
  canWrite: boolean;
};

/** แปลง params JSON เป็น record */
function parseRuleParams(raw: unknown): Record<string, unknown> {
  if (typeof raw === "object" && raw !== null) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** panel ตาราง + การ์ดแก้ไข rule instance */
export function RulesSettingsPanel({ rules, canWrite }: RulesSettingsPanelProps) {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));

  return (
    <ConfigResourcePanel
      canWrite={canWrite}
      tableTitle="รายการกติกา"
      itemCount={rules.length}
      createLabel="เพิ่มกติกา"
      createTitle="เพิ่มกติกาจากแม่แบบ"
      minTableWidth={CONFIG_TABLE_MIN_WIDTH.rules}
      columns={RULES_TABLE_COLUMNS}
      editorVariant="dialog"
      getEditTitle={(id) => byId.get(id)?.ruleTemplateId ?? id}
      renderRows={({ openEdit, isSelected, dialogOpen, canWrite: writeAccess }) =>
        rules.map((rule) => {
          const template = getRuleTemplate(rule.ruleTemplateId);
          const effectiveStatus = getEffectiveStatus(rule.effectiveFrom, rule.effectiveTo);
          return (
            <tr key={rule.id} className="border-b last:border-0">
              <ConfigTableCell>
                <span className="font-medium leading-snug">
                  {template?.displayNameTh ?? rule.ruleTemplateId}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {rule.ruleTemplateId}
                </span>
              </ConfigTableCell>
              <ConfigTableCell>
                <SeverityBadge severity={rule.severity} />
              </ConfigTableCell>
              <ConfigTableCell>
                <span className="text-xs leading-snug">
                  {OVERRIDE_CLASS_LABELS[rule.overrideClass]}
                </span>
              </ConfigTableCell>
              <ConfigTableCell>
                <span className="whitespace-nowrap text-xs">
                  {formatDateInput(rule.effectiveFrom)}
                  {rule.effectiveTo ? ` → ${formatDateInput(rule.effectiveTo)}` : ""}
                </span>
              </ConfigTableCell>
              <ConfigTableCell>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <span
                    className={
                      rule.enabled
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                        : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
                    }
                  >
                    {rule.enabled ? "เปิด" : "ปิด"}
                  </span>
                  <EffectiveStatusBadge status={effectiveStatus} />
                </div>
              </ConfigTableCell>
              <ConfigTableCell>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <RuleToggleButton
                    id={rule.id}
                    enabled={rule.enabled}
                    safetyLocked={template?.safetyLocked ?? false}
                    canWrite={writeAccess}
                  />
                  <ConfigRowActionButton
                    canWrite={writeAccess}
                    selected={isSelected(rule.id)}
                    disabled={dialogOpen}
                    onClick={() => openEdit(rule.id)}
                  />
                </div>
              </ConfigTableCell>
            </tr>
          );
        })
      }
      renderEditor={(mode, close) => {
        if (mode.type === "create") {
          return <RuleInstanceForm canWrite={canWrite} onDone={close} />;
        }

        const rule = byId.get(mode.id);
        if (!rule) {
          return <p className="text-muted-foreground text-sm">ไม่พบรายการ</p>;
        }

        return (
          <RuleInstanceForm
            canWrite={canWrite}
            onDone={close}
            initial={{
              id: rule.id,
              ruleTemplateId: rule.ruleTemplateId,
              params: parseRuleParams(rule.params),
              severity: rule.severity,
              weight: rule.weight,
              overrideClass: rule.overrideClass,
              enabled: rule.enabled,
              effectiveFrom: rule.effectiveFrom,
              effectiveTo: rule.effectiveTo,
            }}
          />
        );
      }}
    />
  );
}
