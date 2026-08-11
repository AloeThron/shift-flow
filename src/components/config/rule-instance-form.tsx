"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createRuleInstanceAction, updateRuleInstanceAction } from "@/actions/config/rules";
import { mergeRuleParams, RuleParamsEditor } from "@/components/config/rule-params-editor";
import { OVERRIDE_CLASS_LABELS, SEVERITY_LABELS } from "@/components/config/ui-labels";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateInput } from "@/domain/config/schemas";
import { getRuleTemplate, RULE_TEMPLATE_REGISTRY } from "@/domain/rules/registry";
import type { OverrideClass, RuleSeverity } from "@/generated/client/client";

type RuleInstanceFormProps = {
  canWrite: boolean;
  initial?: {
    id: string;
    ruleTemplateId: string;
    params: Record<string, unknown>;
    severity: "HARD" | "SOFT";
    weight: number | null;
    overrideClass: "NEVER" | "APPROVER_REQUIRED" | "SCHEDULER_ALLOWED";
    enabled: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  };
  onDone?: () => void;
};

/** ฟอร์ม rule instance (rule pack) */
export function RuleInstanceForm({ canWrite, initial, onDone }: RuleInstanceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(
    initial?.ruleTemplateId ?? RULE_TEMPLATE_REGISTRY[0]?.id ?? "",
  );
  const [params, setParams] = useState<Record<string, unknown>>(() =>
    mergeRuleParams(
      initial?.ruleTemplateId ?? RULE_TEMPLATE_REGISTRY[0]?.id ?? "",
      initial?.params ?? {},
    ),
  );
  const [paramsJsonDraft, setParamsJsonDraft] = useState(() =>
    JSON.stringify(
      mergeRuleParams(
        initial?.ruleTemplateId ?? RULE_TEMPLATE_REGISTRY[0]?.id ?? "",
        initial?.params ?? {},
      ),
      null,
      2,
    ),
  );

  const template = useMemo(() => getRuleTemplate(templateId), [templateId]);

  const defaultOverrideClass = template?.defaultOverrideClass ?? "NEVER";

  // รีเซ็ต params เมื่อเปลี่ยนแม่แบบ (โหมดสร้างใหม่เท่านั้น)
  useEffect(() => {
    if (initial) {
      return;
    }
    const nextParams = mergeRuleParams(templateId, {});
    setParams(nextParams);
    setParamsJsonDraft(JSON.stringify(nextParams, null, 2));
  }, [initial, templateId]);

  const handleParamsChange = (next: Record<string, unknown>) => {
    setParams(next);
    setParamsJsonDraft(JSON.stringify(next, null, 2));
  };

  const handleSubmit = (formData: FormData) => {
    if (!canWrite) return;

    const input = {
      ruleTemplateId: String(formData.get("ruleTemplateId") ?? ""),
      paramsJson: String(formData.get("paramsJson") ?? "{}"),
      severity: String(formData.get("severity") ?? "HARD") as "HARD" | "SOFT",
      weight: formData.get("weight") ? Number(formData.get("weight")) : undefined,
      overrideClass: String(formData.get("overrideClass") ?? "NEVER") as
        "NEVER" | "APPROVER_REQUIRED" | "SCHEDULER_ALLOWED",
      enabled: formData.get("enabled") === "on",
      effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
      effectiveTo: String(formData.get("effectiveTo") ?? "") || undefined,
    };

    startTransition(async () => {
      setError(null);
      const result = initial
        ? await updateRuleInstanceAction(initial.id, input)
        : await createRuleInstanceAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone?.();
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ruleTemplateId">แม่แบบกติกา</Label>
          <NativeSelect
            id="ruleTemplateId"
            name="ruleTemplateId"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            disabled={!canWrite || pending || Boolean(initial)}
          >
            {RULE_TEMPLATE_REGISTRY.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayNameTh}
              </option>
            ))}
          </NativeSelect>
          {template ? (
            <p className="text-muted-foreground text-xs">{template.descriptionTh}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="severity">ระดับความเข้ม</Label>
          <NativeSelect
            id="severity"
            name="severity"
            defaultValue={initial?.severity ?? template?.defaultSeverity ?? "HARD"}
            disabled={!canWrite || pending || template?.safetyLocked}
          >
            {(template?.allowedSeverities ?? (["HARD", "SOFT"] satisfies RuleSeverity[])).map(
              (item) => (
                <option key={item} value={item}>
                  {SEVERITY_LABELS[item]}
                </option>
              ),
            )}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="effectiveFrom">มีผลตั้งแต่</Label>
          <DatePicker
            id="effectiveFrom"
            name="effectiveFrom"
            defaultValue={
              initial ? formatDateInput(initial.effectiveFrom) : formatDateInput(new Date())
            }
            required
            disabled={!canWrite || pending}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>ค่าตั้งกติกา</Label>
          <p className="text-muted-foreground mt-1 text-xs">
            ปรับค่าตามแม่แบบที่เลือก — ไม่ต้องพิมพ์ JSON เอง
          </p>
        </div>

        <RuleParamsEditor
          templateId={templateId}
          value={params}
          onChange={handleParamsChange}
          disabled={!canWrite || pending}
        />

        <input type="hidden" name="paramsJson" value={paramsJsonDraft} readOnly />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial?.enabled ?? true}
          disabled={!canWrite || pending || template?.safetyLocked}
        />
        เปิดใช้งาน
        {template?.safetyLocked ? (
          <span className="text-muted-foreground text-xs">(กฎความปลอดภัย — ปิดไม่ได้)</span>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="overrideClass">การยกเว้น</Label>
          <NativeSelect
            id="overrideClass"
            name="overrideClass"
            defaultValue={initial?.overrideClass ?? defaultOverrideClass}
            disabled={!canWrite || pending || template?.safetyLocked}
          >
            {(template?.allowedOverrideClasses ?? (["NEVER"] satisfies OverrideClass[])).map(
              (item) => (
                <option key={item} value={item}>
                  {OVERRIDE_CLASS_LABELS[item]}
                </option>
              ),
            )}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight">น้ำหนัก (กติกายืดหยุ่น)</Label>
          <Input
            id="weight"
            name="weight"
            type="number"
            min={0}
            defaultValue={initial?.weight ?? 100}
            disabled={!canWrite || pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="effectiveTo">มีผลถึง</Label>
          <DatePicker
            id="effectiveTo"
            name="effectiveTo"
            defaultValue={initial?.effectiveTo ? formatDateInput(initial.effectiveTo) : ""}
            allowClear
            disabled={!canWrite || pending}
          />
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : initial ? "บันทึกการแก้ไข" : "เพิ่มกติกา"}
        </Button>
      ) : null}
    </form>
  );
}
