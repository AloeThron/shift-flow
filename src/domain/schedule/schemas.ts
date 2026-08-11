import { z } from "zod";

/** schema ฟอร์ม StaffGroup */
export const staffGroupFormSchema = z.object({
  code: z
    .string()
    .min(1, "ต้องระบุรหัส")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "รหัสใช้ได้เฉพาะตัวอักษร ตัวเลข _ และ -"),
  displayName: z.string().min(1, "ต้องระบุชื่อแสดง").max(128),
  sortOrder: z.coerce.number().int().min(0).max(999),
  active: z.coerce.boolean().optional(),
});

export type StaffGroupFormInput = z.infer<typeof staffGroupFormSchema>;

/** schema เรียงลำดับกลุ่ม */
export const reorderStaffGroupsSchema = z.object({
  orderedGroupIds: z.array(z.string().min(1)).min(1, "ต้องระบุลำดับกลุ่ม"),
});

/** schema จัดลำดับแถว staff ในกลุ่ม */
export const staffRowOrderSchema = z.object({
  staffProfileId: z.string().min(1),
  staffGroupId: z.string().nullable(),
  rowOrder: z.coerce.number().int().min(0).max(9999),
});

/** การเปลี่ยนเซลล์ assignment */
export const canvasCellChangeSchema = z.object({
  staffProfileId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ YYYY-MM-DD"),
  shiftCodeText: z.string(),
  isPinned: z.boolean().optional(),
  plannedOtHours: z.coerce.number().min(0).max(24).optional(),
});

/** การเปลี่ยนวันหยุดที่วางแผน */
export const canvasPlannedOffChangeSchema = z.object({
  staffProfileId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ YYYY-MM-DD"),
  action: z.enum(["set", "clear"]),
  nonWorkingDayKindId: z.string().optional(),
  locked: z.boolean().optional(),
});

/** การเปลี่ยนโควตาวันหยุดต่อคน */
export const staffDayOffQuotaChangeSchema = z.object({
  staffProfileId: z.string().min(1),
  daysOffQuota: z.coerce.number().int().min(0).max(31),
});

/** schema commit canvas แบบ bulk */
export const commitCanvasChangesSchema = z.object({
  cycleId: z.string().min(1),
  draftId: z.string().min(1),
  draftVersionId: z.string().min(1),
  optimisticVersion: z.coerce.number().int().min(1),
  cellChanges: z.array(canvasCellChangeSchema).optional(),
  plannedOffChanges: z.array(canvasPlannedOffChangeSchema).optional(),
  staffRowOrders: z.array(staffRowOrderSchema).optional(),
  staffDayOffQuotas: z.array(staffDayOffQuotaChangeSchema).optional(),
  override: z.object({ reason: z.string().min(1, "ต้องระบุเหตุผล override") }).optional(),
});

export type CanvasCellChangeInput = z.infer<typeof canvasCellChangeSchema>;
export type CanvasPlannedOffChangeInput = z.infer<typeof canvasPlannedOffChangeSchema>;
export type StaffDayOffQuotaChangeInput = z.infer<typeof staffDayOffQuotaChangeSchema>;
export type CommitCanvasChangesInput = z.infer<typeof commitCanvasChangesSchema>;

/** input สั่ง solver สองระยะ */
export const runScheduleSolverSchema = z.object({
  cycleId: z.string().min(1),
  draftId: z.string().min(1),
  draftVersionId: z.string().min(1),
  optimisticVersion: z.coerce.number().int().min(1),
});

export type RunScheduleSolverInput = z.infer<typeof runScheduleSolverSchema>;

/** schema เผยแพร่ตารางเวร */
export const publishScheduleSchema = z.object({
  cycleId: z.string().min(1),
  draftId: z.string().min(1),
  draftVersionId: z.string().min(1),
  publishReason: z.string().max(500).optional(),
  override: z.object({ reason: z.string().min(1, "ต้องระบุเหตุผล override") }).optional(),
});

export type PublishScheduleInput = z.infer<typeof publishScheduleSchema>;

/** schema สร้างลิงก์แชร์เพิ่ม */
export const createShareLinkSchema = z.object({
  scheduleVersionId: z.string().min(1),
  expiresInDays: z.coerce.number().int().min(1).max(365).default(90),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;

/** schema เพิกถอนลิงก์แชร์ */
export const revokeShareLinkSchema = z.object({
  linkId: z.string().min(1),
});

export type RevokeShareLinkInput = z.infer<typeof revokeShareLinkSchema>;
