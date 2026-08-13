/** ความกว้างขั้นต่ำและ class ร่วมของตารางหน้าตั้งค่า */
export const CONFIG_TABLE_MIN_WIDTH = {
  rules: "820px",
  staff: "960px",
} as const;

/** class หัวคอลัมน์ — จัดกึ่งกลาง */
export const configTableHeadClass =
  "px-2 py-2.5 text-center align-middle text-xs font-medium whitespace-nowrap";

/** class cell ข้อมูล — จัดกึ่งกลาง */
export const configTableCellClass = "px-2 py-2.5 text-center align-middle";

/** wrapper จัดเนื้อหาใน cell ให้อยู่กลาง */
export const configTableCellContentClass = "flex flex-col items-center justify-center gap-1.5";

/** คอลัมน์ตารางกติกาเวร */
export const RULES_TABLE_COLUMNS = [
  { id: "template", label: "แม่แบบ", width: "13rem" },
  { id: "severity", label: "ความเข้ม", width: "5.5rem" },
  { id: "override", label: "การยกเว้น", width: "7rem" },
  { id: "effective", label: "มีผล", width: "9rem" },
  { id: "status", label: "สถานะ", width: "7rem" },
  { id: "actions", label: "การทำงาน", width: "8rem" },
] as const;

/** คอลัมน์ตารางบุคลากร */
export const STAFF_TABLE_COLUMNS = [
  { id: "code", label: "รหัส", width: "5.5rem" },
  { id: "name", label: "ชื่อ", width: "8rem" },
  { id: "grade", label: "ระดับ", width: "4.5rem" },
  { id: "group", label: "กลุ่ม", width: "5rem" },
  { id: "section", label: "หมวดย่อย", width: "7rem" },
  { id: "shiftAuth", label: "สิทธิเวร", width: "5rem" },
  { id: "order", label: "ลำดับ", width: "4rem" },
  { id: "status", label: "สถานะ", width: "5.5rem" },
  { id: "actions", label: "การทำงาน", width: "7.5rem" },
] as const;
