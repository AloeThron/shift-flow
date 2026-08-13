/** ความกว้างและ class ร่วมของตารางรหัสเวร */
export const SHIFT_CODE_TABLE_MIN_WIDTH = "820px";

export const SHIFT_CODE_TABLE_COLUMNS = [
  { id: "code", label: "รหัส", width: "5.5rem" },
  { id: "department", label: "แผนก", width: "4.5rem" },
  { id: "time", label: "เวลา", width: "9.5rem" },
  { id: "hours", label: "ชม.", width: "3.5rem" },
  { id: "headcount", label: "กำลังคนขั้นต่ำ", width: "6.5rem" },
  { id: "grades", label: "ระดับ", width: "7.5rem" },
  { id: "status", label: "สถานะ", width: "6.5rem" },
  { id: "actions", label: "การทำงาน", width: "7.5rem" },
] as const;

/** class หัวคอลัมน์ — จัดกึ่งกลาง */
export const shiftCodeTableHeadClass =
  "px-2 py-2.5 text-center align-middle text-xs font-medium whitespace-nowrap";

/** class cell ข้อมูล — จัดกึ่งกลาง */
export const shiftCodeTableCellClass = "px-2 py-2.5 text-center align-middle";

/** wrapper จัดเนื้อหาใน cell ให้อยู่กลาง */
export const shiftCodeTableCellContentClass = "flex flex-col items-center justify-center gap-1.5";
