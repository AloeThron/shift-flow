/** ป้ายและคำอธิบายพารามิเตอร์กติกา — ใช้ในฟอร์ม admin */

export type RuleParamSelectOption = {
  value: string;
  label: string;
};

export type RuleParamFieldDef =
  | {
      key: string;
      type: "number";
      label: string;
      hint?: string;
      min?: number;
      max?: number;
      step?: number;
      integer?: boolean;
      optional?: boolean;
      unit?: string;
    }
  | {
      key: string;
      type: "boolean";
      label: string;
      hint?: string;
    }
  | {
      key: string;
      type: "select";
      label: string;
      hint?: string;
      options: readonly RuleParamSelectOption[];
      optional?: boolean;
    }
  | {
      key: string;
      type: "string";
      label: string;
      hint?: string;
      optional?: boolean;
      placeholder?: string;
    }
  | {
      key: string;
      type: "stringList";
      label: string;
      hint?: string;
      optional?: boolean;
      placeholder?: string;
    }
  | {
      key: string;
      type: "codeSequenceList";
      label: string;
      hint?: string;
    };

/** ตัวเลือกมิติการกระจายเวร */
export const FAIR_DISTRIBUTION_DIMENSION_OPTIONS: readonly RuleParamSelectOption[] = [
  { value: "TOTAL_HOURS", label: "ชั่วโมงรวม" },
  { value: "OT_HOURS", label: "ชั่วโมง OT" },
  { value: "NIGHT_SHIFTS", label: "จำนวนเวรดึก" },
  { value: "WEEKEND_DAYS", label: "วันหยุดสุดสัปดาห์" },
  { value: "HOLIDAY_DAYS", label: "วันหยุดนักขัตฤกษ์" },
];

/** ตัวเลือกขอบเขตการใช้กติกา */
export const RULE_SCOPE_OPTIONS: readonly RuleParamSelectOption[] = [
  { value: "GROUP", label: "กลุ่มพนักงาน" },
  { value: "ORG", label: "ทั้งองค์กร" },
];

export const RULE_STAFF_SCOPE_OPTIONS: readonly RuleParamSelectOption[] = [
  { value: "GROUP", label: "กลุ่มพนักงาน" },
  { value: "ORG", label: "ทั้งองค์กร" },
  { value: "STAFF", label: "รายบุคคล" },
];

/** นิยามฟิลด์ต่อ rule template */
export const RULE_PARAM_FIELDS: Record<string, readonly RuleParamFieldDef[]> = {
  MIN_REST_BETWEEN_SHIFTS: [
    {
      key: "minRestHours",
      type: "number",
      label: "ชั่วโมงพักขั้นต่ำ",
      hint: "ระยะห่างระหว่างจบเวรหนึ่งกับเริ่มเวรถัดไปของคนเดียวกัน",
      min: 0,
      max: 48,
      step: 0.5,
      unit: "ชม.",
    },
  ],
  MAX_HOURS_IN_WINDOW: [
    {
      key: "rollingWindowHours",
      type: "number",
      label: "กรอบเวลาสะสม",
      hint: "จำนวนชั่วโมงย้อนหลังที่ใช้คำนวณ",
      min: 1,
      max: 168,
      integer: true,
      unit: "ชม.",
    },
    {
      key: "maxHoursInWindow",
      type: "number",
      label: "ชั่วโมงสูงสุดในกรอบ",
      min: 0,
      max: 48,
      step: 0.5,
      unit: "ชม.",
    },
  ],
  MAX_CONSECUTIVE_NIGHTS: [
    {
      key: "maxConsecutiveNights",
      type: "number",
      label: "เวรดึกติดกันสูงสุด",
      min: 1,
      max: 14,
      integer: true,
      unit: "เวร",
    },
    {
      key: "nightShiftCodes",
      type: "stringList",
      label: "รหัสเวรดึก (ถ้าระบุ)",
      hint: "เว้นว่างเพื่อให้ระบบตรวจจากรหัสเวรที่ตั้งไว้",
      optional: true,
      placeholder: "N, N1, N2",
    },
  ],
  MAX_CONSECUTIVE_DAYS: [
    {
      key: "maxConsecutiveDays",
      type: "number",
      label: "วันทำงานติดกันสูงสุด",
      min: 1,
      max: 14,
      integer: true,
      unit: "วัน",
    },
    {
      key: "countOffAsBreak",
      type: "boolean",
      label: "นับวันหยุดเป็นจุดพัก",
      hint: "ถ้าเปิด วันหยุดจะตัดสตรีควันทำงานติดกัน",
    },
  ],
  FORBIDDEN_CODE_SEQUENCE: [
    {
      key: "sequences",
      type: "codeSequenceList",
      label: "ลำดับรหัสที่ห้ามต่อกัน",
      hint: "เช่น กะดึก (N) ตามด้วยกะเช้า (D)",
    },
  ],
  REQUIRED_COVERAGE: [
    {
      key: "enforceFromCoverageRequirements",
      type: "boolean",
      label: "บังคับตาม coverage ที่ตั้งไว้",
      hint: "ใช้ค่าจากหน้าตั้งค่ารหัสเวรและความต้องการคน",
    },
  ],
  REQUIRED_COMPETENCY_IN_SHIFT: [
    {
      key: "enforceExpiry",
      type: "boolean",
      label: "ตรวจวันหมดอายุ competency",
    },
  ],
  GRADE_CODE_WHITELIST: [
    {
      key: "enforceFromShiftCodes",
      type: "boolean",
      label: "จำกัดตามระดับที่รหัสเวรอนุญาต",
    },
  ],
  FAIR_DISTRIBUTION: [
    {
      key: "dimension",
      type: "select",
      label: "มิติที่ต้องกระจาย",
      options: FAIR_DISTRIBUTION_DIMENSION_OPTIONS,
    },
    {
      key: "scope",
      type: "select",
      label: "ขอบเขต",
      options: RULE_SCOPE_OPTIONS,
    },
    {
      key: "toleranceHours",
      type: "number",
      label: "ความต่างที่ยอมรับได้",
      min: 0,
      max: 48,
      step: 0.5,
      unit: "ชม.",
    },
    {
      key: "normalizeByFte",
      type: "boolean",
      label: "ปรับตาม FTE",
      hint: "เปรียบเทียบตามสัดส่วนเวลางานเต็มเวลา",
    },
    {
      key: "lookbackMonths",
      type: "number",
      label: "ย้อนหลัง",
      min: 1,
      max: 12,
      integer: true,
      unit: "เดือน",
    },
  ],
  DAY_OFF_QUOTA: [
    {
      key: "daysOffPerCycle",
      type: "number",
      label: "วันหยุดต่อเดือน",
      hint: "ระบุอย่างน้อยหนึ่งค่าระหว่างรายรอบหรือรายสัปดาห์",
      min: 0,
      max: 31,
      integer: true,
      optional: true,
      unit: "วัน",
    },
    {
      key: "daysOffPerWeek",
      type: "number",
      label: "วันหยุดต่อสัปดาห์",
      min: 0,
      max: 7,
      step: 0.5,
      optional: true,
      unit: "วัน",
    },
    {
      key: "minWeekendDaysOff",
      type: "number",
      label: "วันหยุดสุดสัปดาห์ขั้นต่ำ",
      min: 0,
      max: 8,
      integer: true,
      unit: "วัน",
    },
    {
      key: "scope",
      type: "select",
      label: "ขอบเขต",
      options: RULE_STAFF_SCOPE_OPTIONS,
    },
  ],
  MAX_STAFF_OFF_PER_DAY: [
    {
      key: "maxOffWeekday",
      type: "number",
      label: "คนหยุดสูงสุด (วันธรรมดา)",
      min: 0,
      integer: true,
      optional: true,
      unit: "คน",
    },
    {
      key: "maxOffWeekend",
      type: "number",
      label: "คนหยุดสูงสุด (สุดสัปดาห์)",
      min: 0,
      integer: true,
      optional: true,
      unit: "คน",
    },
    {
      key: "maxOffHoliday",
      type: "number",
      label: "คนหยุดสูงสุด (วันหยุดนักขัตฤกษ์)",
      min: 0,
      integer: true,
      optional: true,
      unit: "คน",
    },
    {
      key: "scope",
      type: "select",
      label: "ขอบเขต",
      options: RULE_SCOPE_OPTIONS,
    },
  ],
  OT_LIMIT: [
    {
      key: "maxOtHoursPerStaffPerCycle",
      type: "number",
      label: "OT สูงสุดต่อคนต่อเดือน",
      hint: "ระบุอย่างน้อยหนึ่งค่าระหว่างต่อคนหรือทั้งองค์กร",
      min: 0,
      max: 200,
      step: 0.5,
      optional: true,
      unit: "ชม.",
    },
    {
      key: "maxOtHoursPerOrgPerCycle",
      type: "number",
      label: "OT สูงสุดทั้งองค์กรต่อเดือน",
      min: 0,
      max: 10000,
      step: 0.5,
      optional: true,
      unit: "ชม.",
    },
  ],
  PREFERRED_PATTERN: [
    {
      key: "description",
      type: "string",
      label: "คำอธิบายรูปแบบ",
      optional: true,
      placeholder: "เช่น หมุนเวรผู้ช่วย",
    },
    {
      key: "gradeCode",
      type: "string",
      label: "ระดับพนักงาน (ถ้าระบุ)",
      optional: true,
      placeholder: "เช่น G3",
    },
    {
      key: "pattern",
      type: "stringList",
      label: "ลำดับรหัสเวร",
      hint: "เรียงรหัสตามรอบหมุน เช่น D, D, N, OFF",
      optional: true,
      placeholder: "D, N, OFF",
    },
  ],
};

/** ดึงนิยามฟิลด์ของ template — คืนค่าว่างถ้าไม่รู้จัก */
export function getRuleParamFields(templateId: string): readonly RuleParamFieldDef[] {
  return RULE_PARAM_FIELDS[templateId] ?? [];
}
