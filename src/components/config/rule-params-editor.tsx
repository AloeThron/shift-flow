"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import {
  getRuleParamFields,
  type RuleParamFieldDef,
} from "@/components/config/rule-param-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getRuleTemplate } from "@/domain/rules/registry";

type CodeSequence = { from: string; to: string };

type RuleParamsEditorProps = {
  templateId: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
};

/** อ่านค่า number จาก params */
function readNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

/** อ่านค่า boolean */
function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

/** อ่านค่า string */
function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** แปลงเป็น string[] */
function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/** แปลงเป็น code sequence list */
function readCodeSequences(value: unknown): CodeSequence[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const row = item as Record<string, unknown>;
      const from = readString(row.from);
      const to = readString(row.to);
      if (!from && !to) {
        return null;
      }
      return { from, to };
    })
    .filter((item): item is CodeSequence => item !== null);
}

/** รวม string list จากข้อความคั่นด้วย comma */
function parseCommaSeparatedList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** อัปเดตคีย์เดียวใน params */
function patchParams(
  current: Record<string, unknown>,
  key: string,
  nextValue: unknown,
  optional: boolean,
): Record<string, unknown> {
  const next = { ...current };

  const isEmpty =
    nextValue === undefined ||
    nextValue === null ||
    nextValue === "" ||
    (Array.isArray(nextValue) && nextValue.length === 0);

  if (optional && isEmpty) {
    delete next[key];
    return next;
  }

  next[key] = nextValue;
  return next;
}

/** ฟิลด์ตัวเลข */
function NumberField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: Extract<RuleParamFieldDef, { type: "number" }>;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  const fallback =
    typeof field.min === "number"
      ? field.min
      : field.optional
        ? undefined
        : 0;
  const current = value[field.key];
  const displayValue =
    current === undefined || current === null
      ? ""
      : String(readNumber(current, fallback ?? 0));

  return (
    <div className="space-y-2">
      <Label htmlFor={`param-${field.key}`}>
        {field.label}
        {field.optional ? (
          <span className="text-muted-foreground ml-1 text-xs font-normal">(ไม่บังคับ)</span>
        ) : null}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={`param-${field.key}`}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? (field.integer ? 1 : 0.1)}
          value={displayValue}
          disabled={disabled}
          placeholder={field.optional ? "ไม่ระบุ" : undefined}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw.trim() === "") {
              onPatch(field.key, undefined, Boolean(field.optional));
              return;
            }
            const parsed = field.integer ? Number.parseInt(raw, 10) : Number(raw);
            if (!Number.isFinite(parsed)) {
              return;
            }
            onPatch(field.key, parsed, Boolean(field.optional));
          }}
        />
        {field.unit ? (
          <span className="text-muted-foreground shrink-0 text-sm">{field.unit}</span>
        ) : null}
      </div>
      {field.hint ? <p className="text-muted-foreground text-xs">{field.hint}</p> : null}
    </div>
  );
}

/** ฟิลด์ boolean */
function BooleanField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: Extract<RuleParamFieldDef, { type: "boolean" }>;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  const checked = readBoolean(value[field.key], false);

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onPatch(field.key, event.target.checked, false)}
        />
        <span>
          <span className="font-medium">{field.label}</span>
          {field.hint ? (
            <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
              {field.hint}
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}

/** ฟิลด์ select */
function SelectField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: Extract<RuleParamFieldDef, { type: "select" }>;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  const current = readString(value[field.key], field.options[0]?.value ?? "");

  return (
    <div className="space-y-2">
      <Label htmlFor={`param-${field.key}`}>{field.label}</Label>
      <NativeSelect
        id={`param-${field.key}`}
        value={current}
        disabled={disabled}
        onChange={(event) => onPatch(field.key, event.target.value, Boolean(field.optional))}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {field.hint ? <p className="text-muted-foreground text-xs">{field.hint}</p> : null}
    </div>
  );
}

/** ฟิลด์ string */
function StringField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: Extract<RuleParamFieldDef, { type: "string" }>;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  const current = readString(value[field.key]);

  return (
    <div className="space-y-2">
      <Label htmlFor={`param-${field.key}`}>
        {field.label}
        {field.optional ? (
          <span className="text-muted-foreground ml-1 text-xs font-normal">(ไม่บังคับ)</span>
        ) : null}
      </Label>
      <Input
        id={`param-${field.key}`}
        value={current}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(event) =>
          onPatch(field.key, event.target.value, Boolean(field.optional))
        }
      />
      {field.hint ? <p className="text-muted-foreground text-xs">{field.hint}</p> : null}
    </div>
  );
}

/** ฟิลด์รายการ string (comma-separated) */
function StringListField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: Extract<RuleParamFieldDef, { type: "stringList" }>;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  const items = readStringList(value[field.key]);
  const display = items.join(", ");

  return (
    <div className="space-y-2">
      <Label htmlFor={`param-${field.key}`}>
        {field.label}
        {field.optional ? (
          <span className="text-muted-foreground ml-1 text-xs font-normal">(ไม่บังคับ)</span>
        ) : null}
      </Label>
      <Input
        id={`param-${field.key}`}
        value={display}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(event) => {
          const next = parseCommaSeparatedList(event.target.value);
          onPatch(field.key, next, Boolean(field.optional));
        }}
      />
      {field.hint ? <p className="text-muted-foreground text-xs">{field.hint}</p> : null}
    </div>
  );
}

/** ฟิลด์ลำดับรหัส from → to */
function CodeSequenceListField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: Extract<RuleParamFieldDef, { type: "codeSequenceList" }>;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  const sequences = readCodeSequences(value[field.key]);

  const updateRow = (index: number, patch: Partial<CodeSequence>) => {
    const next = sequences.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    onPatch(field.key, next, false);
  };

  const addRow = () => {
    onPatch(field.key, [...sequences, { from: "", to: "" }], false);
  };

  const removeRow = (index: number) => {
    onPatch(
      field.key,
      sequences.filter((_, rowIndex) => rowIndex !== index),
      false,
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{field.label}</Label>
        {field.hint ? <p className="text-muted-foreground mt-1 text-xs">{field.hint}</p> : null}
      </div>

      {sequences.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
          ยังไม่มีลำดับที่ห้าม — กด &quot;เพิ่มลำดับ&quot; เพื่อเริ่ม
        </p>
      ) : (
        <ul className="space-y-2">
          {sequences.map((row, index) => (
            <li
              key={`sequence-${index}`}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_1fr_auto]"
            >
              <div className="space-y-1">
                <Label htmlFor={`sequence-from-${index}`} className="text-xs">
                  รหัสก่อนหน้า
                </Label>
                <Input
                  id={`sequence-from-${index}`}
                  value={row.from}
                  placeholder="N"
                  disabled={disabled}
                  onChange={(event) => updateRow(index, { from: event.target.value })}
                />
              </div>
              <span className="text-muted-foreground hidden self-end pb-2 text-sm sm:block">
                →
              </span>
              <div className="space-y-1">
                <Label htmlFor={`sequence-to-${index}`} className="text-xs">
                  รหัสถัดไป
                </Label>
                <Input
                  id={`sequence-to-${index}`}
                  value={row.to}
                  placeholder="D"
                  disabled={disabled}
                  onChange={(event) => updateRow(index, { to: event.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => removeRow(index)}
                  aria-label="ลบลำดับ"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
        <Plus className="size-4" />
        เพิ่มลำดับ
      </Button>
    </div>
  );
}

/** เรนเดอร์ฟิลด์ตามประเภท */
function ParamField({
  field,
  value,
  disabled,
  onPatch,
}: {
  field: RuleParamFieldDef;
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (key: string, nextValue: unknown, optional: boolean) => void;
}) {
  switch (field.type) {
    case "number":
      return (
        <NumberField field={field} value={value} disabled={disabled} onPatch={onPatch} />
      );
    case "boolean":
      return (
        <BooleanField field={field} value={value} disabled={disabled} onPatch={onPatch} />
      );
    case "select":
      return (
        <SelectField field={field} value={value} disabled={disabled} onPatch={onPatch} />
      );
    case "string":
      return (
        <StringField field={field} value={value} disabled={disabled} onPatch={onPatch} />
      );
    case "stringList":
      return (
        <StringListField field={field} value={value} disabled={disabled} onPatch={onPatch} />
      );
    case "codeSequenceList":
      return (
        <CodeSequenceListField
          field={field}
          value={value}
          disabled={disabled}
          onPatch={onPatch}
        />
      );
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

/** รวมค่า default จาก template กับค่าที่มีอยู่ */
export function mergeRuleParams(
  templateId: string,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const template = getRuleTemplate(templateId);
  return {
    ...(template?.defaultParams ?? {}),
    ...current,
  };
}

/** ฟอร์มค่าตั้งกติกาแบบอ่านง่าย — แทน JSON textarea */
export function RuleParamsEditor({
  templateId,
  value,
  onChange,
  disabled,
}: RuleParamsEditorProps) {
  const fields = useMemo(() => getRuleParamFields(templateId), [templateId]);
  const mergedValue = useMemo(() => mergeRuleParams(templateId, value), [templateId, value]);

  const handlePatch = (key: string, nextValue: unknown, optional: boolean) => {
    onChange(patchParams(mergedValue, key, nextValue, optional));
  };

  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        ไม่มีฟอร์มสำหรับแม่แบบนี้ — ติดต่อผู้ดูแลระบบ
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div
          key={field.key}
          className={
            field.type === "codeSequenceList" || field.type === "stringList"
              ? "sm:col-span-2"
              : undefined
          }
        >
          <ParamField
            field={field}
            value={mergedValue}
            disabled={disabled}
            onPatch={handlePatch}
          />
        </div>
      ))}
    </div>
  );
}
