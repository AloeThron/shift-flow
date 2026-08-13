import { z } from "zod";

/** schema ฟอร์มแผนก */
export const departmentFormSchema = z.object({
  code: z
    .string()
    .min(1, "ต้องระบุรหัส")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "รหัสใช้ได้เฉพาะตัวอักษร ตัวเลข _ และ -"),
  displayName: z.string().min(1, "ต้องระบุชื่อแสดง").max(128),
  sortOrder: z.coerce.number().int().min(0).max(999),
  active: z.coerce.boolean(),
});

export type DepartmentFormInput = z.infer<typeof departmentFormSchema>;

/** schema ฟอร์ม shift code */
export const shiftCodeFormSchema = z.object({
  canonicalCode: z.string().min(1, "ต้องระบุรหัส").max(32),
  departmentId: z.string().optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "รูปแบบ HH:MM")
    .optional()
    .or(z.literal("")),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "รูปแบบ HH:MM")
    .optional()
    .or(z.literal("")),
  standardHours: z.coerce.number().min(0).max(24).optional(),
  allowedGradeCodes: z.array(z.string().min(1)).min(1, "ต้องเลือกระดับพนักงานอย่างน้อย 1 รายการ"),
  needsConfirmation: z.coerce.boolean(),
  deprecated: z.coerce.boolean(),
});

export type ShiftCodeFormInput = z.infer<typeof shiftCodeFormSchema>;

/** schema อัปเดตแผนกของรหัสเวร (popover ในแถว) */
export const shiftCodeDepartmentFormSchema = z.object({
  departmentId: z.string().optional(),
});

export type ShiftCodeDepartmentFormInput = z.infer<typeof shiftCodeDepartmentFormSchema>;

/** schema ฟอร์ม shift code demand */
export const shiftCodeDemandFormSchema = z.object({
  shiftCodeId: z.string().min(1, "ต้องเลือกรหัสเวร"),
  name: z.string().min(1, "ต้องระบุชื่อ").max(128),
  minHeadcount: z.coerce.number().int().min(1).max(99),
  requiresLead: z.coerce.boolean(),
  weekdayMask: z.coerce.number().int().min(1).max(127),
  appliesOnHolidays: z.coerce.boolean(),
  effectiveFrom: z.string().min(1, "ต้องระบุวันเริ่มมีผล"),
  effectiveTo: z.string().optional(),
  active: z.coerce.boolean(),
});

export type ShiftCodeDemandFormInput = z.infer<typeof shiftCodeDemandFormSchema>;

/** schema ฟอร์ม rule instance */
export const ruleInstanceFormSchema = z.object({
  ruleTemplateId: z.string().min(1),
  paramsJson: z.string().min(2, "ต้องระบุพารามิเตอร์ JSON"),
  severity: z.enum(["HARD", "SOFT"]),
  weight: z.coerce.number().min(0).max(1000).optional(),
  overrideClass: z.enum(["NEVER", "APPROVER_REQUIRED", "SCHEDULER_ALLOWED"]),
  enabled: z.coerce.boolean(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
});

export type RuleInstanceFormInput = z.infer<typeof ruleInstanceFormSchema>;

/** schema pay rule config */
export const payRuleConfigSchema = z.object({
  otMultiplier: z.coerce.number().min(1).max(5),
  nightAllowancePerShift: z.coerce.number().min(0).max(100000),
  holidayAllowancePerShift: z.coerce.number().min(0).max(100000),
  roundingMinutes: z.coerce.number().int().min(0).max(60),
  notes: z.string().max(500).optional(),
});

export const payRuleFormSchema = z.object({
  name: z.string().min(1, "ต้องระบุชื่อ").max(128),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
  config: payRuleConfigSchema,
});

export type PayRuleFormInput = z.infer<typeof payRuleFormSchema>;

/** schema ฟอร์มบุคลากร */
export const staffFormSchema = z.object({
  staffCode: z
    .string()
    .min(1, "ต้องระบุรหัสพนักงาน")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "รหัสใช้ได้เฉพาะตัวอักษร ตัวเลข _ และ -"),
  displayName: z.string().min(1, "ต้องระบุชื่อ").max(128),
  email: z.string().email("อีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  staffGradeId: z.string().min(1, "ต้องเลือกระดับพนักงาน"),
  staffGroupId: z.string().min(1, "ต้องเลือกกลุ่ม"),
  staffGroupSection: z.enum(["RESULT_CAPABLE", "RESULT_NOT_CAPABLE", "PART_TIME"]),
  rowOrder: z.coerce.number().int().min(0).max(999),
  active: z.coerce.boolean(),
  contractType: z.enum(["FULL_TIME", "PART_TIME", "NO_GUARANTEED_HOURS"]),
  fte: z.coerce.number().min(0).max(2),
});

export type StaffFormInput = z.infer<typeof staffFormSchema>;

/** schema เลือกสิทธิปฏิบัติงานแบบ checkbox (+ ทุกรหัสเวร) */
export const staffShiftAuthorizationFormSchema = z
  .object({
    coversAll: z.coerce.boolean(),
    shiftCodeIds: z.array(z.string()),
    assessedAt: z.string().min(1, "ต้องระบุวันอนุมัติ"),
    expiresAt: z.string().optional(),
    level: z.string().max(64).optional().or(z.literal("")),
    authorizedByStaffId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.coversAll && data.shiftCodeIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ต้องเลือกรหัสเวรอย่างน้อยหนึ่งรายการ หรือเลือกทุกรหัสเวร",
        path: ["shiftCodeIds"],
      });
    }

    if (!data.expiresAt) {
      return;
    }
    const assessed = parseDateInput(data.assessedAt);
    const expires = parseDateInput(data.expiresAt);
    if (expires < assessed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "วันหมดอายุต้องไม่ก่อนวันอนุมัติ",
        path: ["expiresAt"],
      });
    }
  });

export type StaffShiftAuthorizationFormInput = z.infer<typeof staffShiftAuthorizationFormSchema>;

/** บวกเดือนให้วันที่ (local) */
export function addMonthsToDate(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** แปลง string วันที่เป็น Date (local midnight) */
export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** แปลง Date เป็น input date string */
export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
