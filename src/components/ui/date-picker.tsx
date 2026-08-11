"use client";

import { th } from "date-fns/locale";
import { CalendarIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateInput, parseDateInput } from "@/domain/config/schemas";
import { keepOverlayOpenOnNestedSelect } from "@/lib/ui/nested-select";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id?: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  className?: string;
};

/** แสดงวันที่แบบอ่านง่าย (ภาษาไทย) */
function formatDisplayDate(value: string): string {
  if (!value) {
    return "";
  }

  return parseDateInput(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** ช่องเลือกวันที่ — Popover + Calendar สไตล์ shadcn */
function DatePicker({
  id,
  name,
  defaultValue = "",
  required,
  disabled,
  allowClear = false,
  placeholder = "เลือกวันที่",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue);

  const selectedDate = value ? parseDateInput(value) : undefined;

  /** อัปเดตค่าเมื่อเลือกจากปฏิทิน */
  const handleSelect = (date: Date | undefined): void => {
    if (!date) {
      return;
    }

    setValue(formatDateInput(date));
    setOpen(false);
  };

  /** ล้างวันที่ (เฉพาะฟิลด์ที่ไม่บังคับ) */
  const handleClear = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setValue("");
  };

  return (
    <>
      <input type="hidden" name={name} value={value} required={required && !value} />
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-required={required || undefined}
            className={cn(
              "border-input bg-background dark:bg-input/30 h-9 w-full justify-start rounded-[1.25rem] px-3 text-left text-sm font-normal shadow-xs",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="flex-1 truncate">{value ? formatDisplayDate(value) : placeholder}</span>
            {allowClear && value && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="ล้างวันที่"
                className="text-muted-foreground hover:text-foreground ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
                onClick={handleClear}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setValue("");
                  }
                }}
              >
                <XIcon className="size-3.5" />
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-visible p-0"
          align="center"
          onPointerDownOutside={keepOverlayOpenOnNestedSelect}
          onInteractOutside={keepOverlayOpenOnNestedSelect}
          onFocusOutside={keepOverlayOpenOnNestedSelect}
        >
          <Calendar
            mode="single"
            locale={th}
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={handleSelect}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(2040, 11)}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

export { DatePicker };
