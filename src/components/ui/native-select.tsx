"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** ค่าว่าง — Radix ห้ามใช้ value="" */
const EMPTY_VALUE = "__sf_empty__";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
};

/** ดึงชื่อ type ของ element สำหรับจับ option/optgroup */
const getTypeName = (type: string | React.JSXElementConstructor<unknown>): string => {
  if (typeof type === "string") return type;
  return (type as { displayName?: string }).displayName ?? "";
};

/** ดึง option จาก children แบบ <option> */
const extractOptions = (children: React.ReactNode): SelectOption[] =>
  React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<{
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      }>(child)
    ) {
      return [];
    }

    const typeName = getTypeName(child.type);

    if (child.type === "optgroup" || typeName === "NativeSelectOptGroup") {
      return extractOptions(child.props.children);
    }

    if (child.type === "option" || typeName === "NativeSelectOption") {
      const rawValue = child.props.value;
      const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
      const label = React.Children.toArray(child.props.children)
        .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
        .join("")
        .trim();

      return [{ value, label, disabled: child.props.disabled }];
    }

    return [];
  });

const toSelectValue = (value: string): string => (value === "" ? EMPTY_VALUE : value);
const fromSelectValue = (value: string): string => (value === EMPTY_VALUE ? "" : value);

/** select สไตล์ custom — ใช้ Radix เพื่อให้ทั้งปุ่มและรายการโค้งได้จริง */
function NativeSelect({
  className,
  size = "default",
  disabled,
  children,
  name,
  id,
  required,
  value,
  defaultValue,
  onChange,
  ...props
}: NativeSelectProps) {
  const options = React.useMemo(() => extractOptions(children), [children]);
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(() => String(defaultValue ?? ""));
  const current = isControlled ? String(value) : uncontrolled;

  /** อัปเดตค่า + ยิง onChange แบบ native select */
  const handleValueChange = (nextSelectValue: string): void => {
    const next = fromSelectValue(nextSelectValue);
    if (!isControlled) {
      setUncontrolled(next);
    }
    onChange?.({
      target: { value: next, name: name ?? "" },
      currentTarget: { value: next, name: name ?? "" },
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  // ตัด props ของ native select ที่ Radix ไม่ใช้
  void props;

  return (
    <>
      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
      <Select value={toSelectValue(current)} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          size={size}
          aria-required={required || undefined}
          className={cn("w-full rounded-[1.25rem]", className)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="center" className="rounded-[1.25rem]">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={`${option.value}::${option.label}`}
                value={toSelectValue(option.value)}
                disabled={option.disabled}
                className="rounded-xl"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

/** option ใน NativeSelect — คง API เดิมไว้ */
function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}
NativeSelectOption.displayName = "NativeSelectOption";

/** optgroup ใน NativeSelect */
function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}
NativeSelectOptGroup.displayName = "NativeSelectOptGroup";

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
