/** meta รอบตารางที่ publish แล้ว — สำหรับหน้า share */
export type PublishedScheduleMeta = {
  id: string;
  versionNumber: number;
  cycleName: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string | null;
};

/** เซลล์ตารางเวรแบบอ่านอย่างเดียว — ไม่มี staff code / PII */
export type PublishedRosterGridCell = {
  localDate: string;
  displayCode: string | null;
  isNonWorkingDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

/** แถวพนักงานในตาราง share */
export type PublishedRosterGridRow = {
  staffProfileId: string;
  displayName: string;
  cells: readonly PublishedRosterGridCell[];
};

/** meta รหัสเวรสำหรับ styling */
export type PublishedRosterShiftCodeMeta = {
  code: string;
  isNightShift: boolean;
};

/** ตารางเวร pivot สำหรับหน้า share */
export type PublishedRosterGridView = {
  schedule: PublishedScheduleMeta;
  timezone: string;
  dates: readonly string[];
  rows: readonly PublishedRosterGridRow[];
  shiftCodes: readonly PublishedRosterShiftCodeMeta[];
};
