# Rule Template Registry

> **สถานะ:** Engine Gate — registry สpec สำหรับ implement ที่ `src/domain/rules/`  
> **อัปเดต:** 2026-08-11  
> **คู่กับ:** [configuration-model.md](./configuration-model.md) · [constraint-catalog.md](./constraint-catalog.md)

---

## 1. โครงสร้าง Registry

แต่ละ template ใน registry ประกอบด้วย:

| ฟิลด์                      | ประเภท                   | คำอธิบาย                                                                  |
| ------------------------ | ------------------------ | ----------------------------------------------------------------------- |
| `id`                     | string (SCREAMING_SNAKE) | คีย์ถาวร — ไม่ rename หลัง release                                          |
| `displayNameTh`          | string                   | ชื่อแสดงใน admin UI                                                       |
| `descriptionTh`          | string                   | คำอธิบายสำหรับผู้จัดเวร                                                        |
| `category`               | enum                     | `SAFETY` · `LABOR` · `COVERAGE` · `COMPETENCY` · `FAIRNESS` · `PATTERN` |
| `paramSchema`            | Zod schema               | validate `RuleInstance.params`                                          |
| `defaultParams`          | object                   | ค่าแนะนำเมื่อเปิดใช้ครั้งแรก                                                    |
| `defaultSeverity`        | `HARD` \| `SOFT`         | ค่าเริ่มต้น                                                                 |
| `allowedSeverities`      | array                    | severity ที่ admin เลือกได้                                                 |
| `defaultOverrideClass`   | OverrideClass            | ค่าเริ่มต้น                                                                 |
| `allowedOverrideClasses` | array                    | override ที่ admin เลือกได้                                                 |
| `safetyLocked`           | boolean                  | `true` = บังคับ HARD + NEVER; ปิดไม่ได้                                      |
| `constraintCatalogRef`   | string?                  | อ้าง HC-/SC- ใน constraint catalog                                       |
| `validatorKey`           | string                   | ฟังก์ชันใน `src/domain/rules/validators/`                                  |

### OverrideClass

| ค่า                  | ความหมาย                                     |
| ------------------- | -------------------------------------------- |
| `NEVER`             | ห้าม override                                 |
| `APPROVER_REQUIRED` | Lab Head / delegate + reason (+ expiry แนะนำ) |
| `SCHEDULER_ALLOWED` | scheduler บันทึกเหตุผล (soft trade-off)         |

### การเพิ่ม template ใหม่

1. เปิด issue พร้อมตัวอย่าง violation จากหน้างาน
2. เพิ่ม definition ใน registry + validator + tests
3. **ไม่** แก้เฉพาะกิจใน org เดียว — ต้องเป็น template ทั่วไป
4. อัปเดตเอกสารนี้และ [configuration-model.md](./configuration-model.md)

---

## 2. Engine Invariants (ไม่ใช่ RuleInstance)

invariant เหล่านี้ implement ใน engine โดยตรง — **ไม่ปรากฏใน admin UI เป็น template ที่ปิดได้**

| Key                        | คำอธิบาย                                            | Catalog |
| -------------------------- | ------------------------------------------------- | ------- |
| `NO_TIME_OVERLAP`          | staff คนเดียวไม่มี assignment ทับเวลา                 | HC-001  |
| `APPROVED_LEAVE_BLOCK`     | ไม่จัดทับ approved leave / hard unavailability       | HC-002  |
| `UNCONFIRMED_CODE_BLOCKED` | ไม่ assign รหัส `needsConfirmation` / UNKNOWN       | —       |
| `MIDNIGHT_INTEGRITY`       | assignment ข้ามคืนใช้ instant UTC + local date ถูกต้อง | HC-009  |

---

## 3. Rule Templates — Configurable

### 3.1 MIN_REST_BETWEEN_SHIFTS

| ฟิลด์                        | ค่า                                                            |
| -------------------------- | ------------------------------------------------------------- |
| **ID**                     | `MIN_REST_BETWEEN_SHIFTS`                                     |
| **displayNameTh**          | พักขั้นต่ำระหว่างเวร                                                |
| **descriptionTh**          | ระยะห่างระหว่างจบเวรหนึ่งกับเริ่มเวรถัดไปของคนเดียวกัน ต้องไม่น้อยกว่าที่กำหนด |
| **category**               | `LABOR`                                                       |
| **constraintCatalogRef**   | HC-005                                                        |
| **safetyLocked**           | `true`                                                        |
| **defaultSeverity**        | `HARD`                                                        |
| **allowedSeverities**      | `["HARD"]`                                                    |
| **defaultOverrideClass**   | `NEVER`                                                       |
| **allowedOverrideClasses** | `["NEVER"]`                                                   |

**พารามิเตอร์ (Zod):**

```typescript
import { z } from "zod";

export const minRestBetweenShiftsParams = z.object({
  minRestHours: z.number().min(0).max(48),
});
// defaultParams: { minRestHours: 11 }
```

**ตัวอย่าง violation:** จบ 06:00 เริ่ม 14:00 วันเดียวกัน → rest 8 ชม. (< 11)

---

### 3.2 MAX_HOURS_IN_WINDOW

| ฟิลด์                      | ค่า                               |
| ------------------------ | -------------------------------- |
| **ID**                   | `MAX_HOURS_IN_WINDOW`            |
| **displayNameTh**        | ชั่วโมงสูงสุดในกรอบเวลา              |
| **descriptionTh**        | จำกัดชั่วโมงงานสะสมใน rolling window |
| **category**             | `LABOR`                          |
| **constraintCatalogRef** | HC-006                           |
| **safetyLocked**         | `true`                           |
| **defaultSeverity**      | `HARD`                           |
| **defaultOverrideClass** | `NEVER`                          |

**พารามิเตอร์ (Zod):**

```typescript
export const maxHoursInWindowParams = z.object({
  rollingWindowHours: z.number().int().min(1).max(168),
  maxHoursInWindow: z.number().min(0).max(48),
});
// defaultParams: { rollingWindowHours: 24, maxHoursInWindow: 16 }
```

---

### 3.3 MAX_CONSECUTIVE_DAYS

| ฟิลด์                        | ค่า                                             |
| -------------------------- | ---------------------------------------------- |
| **ID**                     | `MAX_CONSECUTIVE_DAYS`                         |
| **displayNameTh**          | วันทำงานติดกันสูงสุด                                 |
| **descriptionTh**          | จำกัดจำนวนวันที่มี assignment ติดกัน (นับตาม local date) |
| **category**               | `LABOR`                                        |
| **safetyLocked**           | `false`                                        |
| **defaultSeverity**        | `HARD`                                         |
| **allowedSeverities**      | `["HARD", "SOFT"]`                             |
| **defaultOverrideClass**   | `NEVER`                                        |
| **allowedOverrideClasses** | `["NEVER", "APPROVER_REQUIRED"]`               |

**พารามิเตอร์ (Zod):**

```typescript
export const maxConsecutiveDaysParams = z.object({
  maxConsecutiveDays: z.number().int().min(1).max(14),
  countOffAsBreak: z.boolean().default(true),
});
// defaultParams: { maxConsecutiveDays: 6, countOffAsBreak: true }
```

---

### 3.4 MAX_CONSECUTIVE_NIGHTS

| ฟิลด์                      | ค่า                       |
| ------------------------ | ------------------------ |
| **ID**                   | `MAX_CONSECUTIVE_NIGHTS` |
| **displayNameTh**        | เวรดึกติดกันสูงสุด            |
| **descriptionTh**        | จำกัดจำนวนเวรดึกติดกันต่อ staff |
| **category**             | `LABOR`                  |
| **constraintCatalogRef** | HC-007                   |
| **safetyLocked**         | `true`                   |
| **defaultSeverity**      | `HARD`                   |
| **defaultOverrideClass** | `NEVER`                  |

**พารามิเตอร์ (Zod):**

```typescript
export const maxConsecutiveNightsParams = z.object({
  maxConsecutiveNights: z.number().int().min(1).max(7),
  nightShiftCodeIds: z.array(z.string()).min(1),
  // nightShiftCodeIds = FK ShiftCode ที่องค์กรกำหนดว่าเป็น "เวรดึก"
});
// defaultParams: { maxConsecutiveNights: 3, nightShiftCodeIds: [] }
// หมายเหตุ: nightShiftCodeIds ว่างจนกว่า org จะตั้งรหัสดึกใน admin
```

---

### 3.5 FORBIDDEN_CODE_SEQUENCE

| ฟิลด์                      | ค่า                                                    |
| ------------------------ | ----------------------------------------------------- |
| **ID**                   | `FORBIDDEN_CODE_SEQUENCE`                             |
| **displayNameTh**        | ห้ามลำดับรหัสต่อกัน                                         |
| **descriptionTh**        | ห้ามรหัสหนึ่งตามด้วยอีกรหัสในวันถัดไป (หรือช่วงที่กำหนด) เช่น ดึก→เช้า |
| **category**             | `LABOR`                                               |
| **constraintCatalogRef** | HC-008                                                |
| **safetyLocked**         | `true`                                                |
| **defaultSeverity**      | `HARD`                                                |
| **defaultOverrideClass** | `NEVER`                                               |

**พารามิเตอร์ (Zod):**

```typescript
export const forbiddenCodeSequenceParams = z.object({
  fromShiftCodeIds: z.array(z.string()).min(1),
  toShiftCodeIds: z.array(z.string()).min(1),
  minGapHours: z.number().min(0).optional(),
  // minGapHours: ถ้าระบุ ใช้แทน/เสริม MIN_REST สำหรับคู่นี้โดยเฉพาะ
});
// ตัวอย่าง night→day: from=[N1,N2], to=[codes ที่เริ่มก่อน 14:00], minGapHours: 11
```

หนึ่ง `RuleInstance` = หนึ่งชุด from/to; org สร้างหลาย instance ได้

---

### 3.6 REQUIRED_COVERAGE

| ฟิลด์                        | ค่า                                                         |
| -------------------------- | ---------------------------------------------------------- |
| **ID**                     | `REQUIRED_COVERAGE`                                        |
| **displayNameTh**          | coverage ขั้นต่ำ                                               |
| **descriptionTh**          | ทุกช่วงเวลาและพื้นที่ต้องมีจำนวนคน (และ competency/lead ถ้ากำหนด) ครบ |
| **category**               | `COVERAGE`                                                 |
| **constraintCatalogRef**   | HC-004                                                     |
| **safetyLocked**           | `true`                                                     |
| **defaultSeverity**        | `HARD`                                                     |
| **defaultOverrideClass**   | `NEVER`                                                    |
| **allowedOverrideClasses** | `["NEVER", "APPROVER_REQUIRED"]`                           |

**พารามิเตอร์ (Zod):**

```typescript
export const requiredCoverageParams = z.object({
  coverageRequirementIds: z.array(z.string()).min(1),
  allowEmergencyOverride: z.boolean().default(true),
});
// อ้าง CoverageRequirement records ของ org — ไม่ duplicate ตัวเลขใน params
// EC-001: allowEmergencyOverride=true → APPROVER_REQUIRED path
```

---

### 3.7 REQUIRED_COMPETENCY_IN_SHIFT

| ฟิลด์                      | ค่า                                                            |
| ------------------------ | ------------------------------------------------------------- |
| **ID**                   | `REQUIRED_COMPETENCY_IN_SHIFT`                                |
| **displayNameTh**        | competency ต้อง valid ตลอดเวร                                  |
| **descriptionTh**        | ทุก assignment ที่ระบุ competency ต้องมี authorization ครอบคลุมทั้งช่วง |
| **category**             | `COMPETENCY`                                                  |
| **constraintCatalogRef** | HC-003                                                        |
| **safetyLocked**         | `true`                                                        |
| **defaultSeverity**      | `HARD`                                                        |
| **defaultOverrideClass** | `NEVER`                                                       |

**พารามิเตอร์ (Zod):**

```typescript
export const requiredCompetencyInShiftParams = z.object({
  enforceSupervision: z.boolean().default(false),
});
// ไม่มีตัวเลข — อ่านจาก ShiftTemplate + StaffCompetencyAuthorization
```

---

### 3.8 GRADE_CODE_WHITELIST

| ฟิลด์                      | ค่า                                                                |
| ------------------------ | ----------------------------------------------------------------- |
| **ID**                   | `GRADE_CODE_WHITELIST`                                            |
| **displayNameTh**        | รหัสที่แต่ละระดับใช้ได้                                                  |
| **descriptionTh**        | จำกัดว่า staff grade ใด assign รหัสใดได้ — จาก ShiftCode.staffGradeIds |
| **category**             | `COMPETENCY`                                                      |
| **safetyLocked**         | `false`                                                           |
| **defaultSeverity**      | `HARD`                                                            |
| **allowedSeverities**    | `["HARD", "SOFT"]`                                                |
| **defaultOverrideClass** | `NEVER`                                                           |

**พารามิเตอร์ (Zod):**

```typescript
export const gradeCodeWhitelistParams = z.object({
  enforceFromShiftCode: z.boolean().default(true),
  // true = อ่าน whitelist จาก ShiftCode ต่อ org
  // false = ใช้ matrix ใน params (advanced)
  gradeCodeMatrix: z.record(z.string(), z.array(z.string())).optional(),
});
```

Discovery evidence: MT ไม่ได้ `F/16`, `N1`; ผู้ช่วยไม่ได้ `N1`, `INC` — org กำหนดใน ShiftCode ไม่ใช่ใน engine

---

### 3.9 FAIR_DISTRIBUTION

| ฟิลด์                      | ค่า                                                                |
| ------------------------ | ----------------------------------------------------------------- |
| **ID**                   | `FAIR_DISTRIBUTION`                                               |
| **displayNameTh**        | กระจายเวรอย่างเป็นธรรม                                              |
| **descriptionTh**        | ลดความไม่สมดุลของชั่วโมง OT เวรดึก วันหยุด ตาม FTE และ carry-over ข้ามรอบ |
| **category**             | `FAIRNESS`                                                        |
| **constraintCatalogRef** | SC-001, SC-002, SC-007                                            |
| **safetyLocked**         | `false`                                                           |
| **defaultSeverity**      | `SOFT`                                                            |
| **allowedSeverities**    | `["SOFT"]`                                                        |
| **defaultOverrideClass** | `SCHEDULER_ALLOWED`                                               |

**พารามิเตอร์ (Zod):**

```typescript
export const fairDistributionParams = z.object({
  dimension: z.enum([
    "TOTAL_HOURS",
    "OT_HOURS",
    "NIGHT_SHIFTS",
    "WEEKEND_DAYS",
    "HOLIDAY_DAYS",
  ]),
  scope: z.enum(["GROUP", "ORG"]).default("GROUP"),
  toleranceHours: z.number().min(0).max(48).default(4),
  normalizeByFte: z.boolean().default(true),
  lookbackMonths: z.number().int().min(1).max(12).default(6),
  // lookbackMonths ≤ historyWindowMonths ของ SchedulingPolicy
});
// defaultParams: { dimension: "TOTAL_HOURS", scope: "GROUP", toleranceHours: 4, normalizeByFte: true, lookbackMonths: 6 }
```

ใช้ทั้งเป็น soft validator และเป็นที่มาของ convex cost ใน Stage B (ดู [optimization-model.md](./optimization-model.md))

---

### 3.10 DAY_OFF_QUOTA

| ฟิลด์                      | ค่า                                        |
| ------------------------ | ----------------------------------------- |
| **ID**                   | `DAY_OFF_QUOTA`                           |
| **displayNameTh**        | โควตาวันหยุดต่อเดือน                          |
| **descriptionTh**        | จำนวนวันหยุดที่แต่ละคนต้องได้ในรอบ — อินพุต Stage A |
| **category**             | `LABOR`                                   |
| **constraintCatalogRef** | HC-010                                    |
| **safetyLocked**         | `false`                                   |
| **defaultSeverity**      | `HARD`                                    |
| **allowedSeverities**    | `["HARD", "SOFT"]`                        |
| **defaultOverrideClass** | `APPROVER_REQUIRED`                       |

**พารามิเตอร์ (Zod):**

```typescript
export const dayOffQuotaParams = z.object({
  daysOffPerCycle: z.number().int().min(0).max(31).optional(),
  daysOffPerWeek: z.number().min(0).max(7).optional(),
  minWeekendDaysOff: z.number().int().min(0).max(8).default(0),
  scope: z.enum(["GROUP", "ORG", "STAFF"]).default("GROUP"),
});
// ต้องระบุ daysOffPerCycle หรือ daysOffPerWeek อย่างน้อยหนึ่งค่า
```

---

### 3.11 MAX_STAFF_OFF_PER_DAY

| ฟิลด์                      | ค่า                                                      |
| ------------------------ | ------------------------------------------------------- |
| **ID**                   | `MAX_STAFF_OFF_PER_DAY`                                 |
| **displayNameTh**        | เพดานคนหยุดพร้อมกันต่อวัน                                    |
| **descriptionTh**        | capacity ของ Stage A — แยกวันธรรมดา/สุดสัปดาห์/วันหยุดนักขัตฤกษ์ |
| **category**             | `COVERAGE`                                              |
| **constraintCatalogRef** | HC-011                                                  |
| **safetyLocked**         | `false`                                                 |
| **defaultSeverity**      | `HARD`                                                  |
| **defaultOverrideClass** | `APPROVER_REQUIRED`                                     |

**พารามิเตอร์ (Zod):**

```typescript
export const maxStaffOffPerDayParams = z.object({
  maxOffWeekday: z.number().int().min(0).optional(),
  maxOffWeekend: z.number().int().min(0).optional(),
  maxOffHoliday: z.number().int().min(0).optional(),
  scope: z.enum(["GROUP", "ORG"]).default("GROUP"),
});
```

---

### 3.12 OT_LIMIT

| ฟิลด์                      | ค่า                                               |
| ------------------------ | ------------------------------------------------ |
| **ID**                   | `OT_LIMIT`                                       |
| **displayNameTh**        | เพดาน OT ต่อเดือน                                  |
| **descriptionTh**        | จำกัด OT สะสมต่อคนและ/หรือทั้งองค์กร — capacity Stage B |
| **category**             | `LABOR`                                          |
| **constraintCatalogRef** | HC-012                                           |
| **safetyLocked**         | `true`                                           |
| **defaultSeverity**      | `HARD`                                           |
| **defaultOverrideClass** | `NEVER`                                          |

**พารามิเตอร์ (Zod):**

```typescript
export const otLimitParams = z.object({
  maxOtHoursPerStaffPerCycle: z.number().min(0).max(200).optional(),
  maxOtHoursPerOrgPerCycle: z.number().min(0).max(10000).optional(),
});
```

---

### 3.13 PREFERRED_PATTERN

| ฟิลด์                      | ค่า                                                       |
| ------------------------ | -------------------------------------------------------- |
| **ID**                   | `PREFERRED_PATTERN`                                      |
| **displayNameTh**        | รูปแบบหมุนเวียนที่ต้องการ                                      |
| **descriptionTh**        | ให้คะแนนเมื่อลำดับรหัสตรง pattern ที่ org กำหนด เช่น rotation ผู้ช่วย |
| **category**             | `PATTERN`                                                |
| **constraintCatalogRef** | SC-004, Q8                                               |
| **safetyLocked**         | `false`                                                  |
| **defaultSeverity**      | `SOFT`                                                   |
| **defaultOverrideClass** | `SCHEDULER_ALLOWED`                                      |

**พารามิเตอร์ (Zod):**

```typescript
export const preferredPatternParams = z.object({
  patternName: z.string().min(1),
  steps: z
    .array(
      z.object({
        shiftCodeId: z.string().nullable(),
        // null = off / ไม่ assign
        maxSlipDays: z.number().int().min(0).default(0),
      }),
    )
    .min(2),
  appliesToStaffGradeIds: z.array(z.string()).optional(),
  appliesToStaffIds: z.array(z.string()).optional(),
});
// ตัวอย่าง Q8: B/17 → cs/19 → บด → off
```

---

## 4. สรุป Registry

| ID                             | Category   | Safety Lock | Default Severity | Catalog        |
| ------------------------------ | ---------- | :---------: | ---------------- | -------------- |
| `MIN_REST_BETWEEN_SHIFTS`      | LABOR      |      ✓      | HARD             | HC-005         |
| `MAX_HOURS_IN_WINDOW`          | LABOR      |      ✓      | HARD             | HC-006         |
| `MAX_CONSECUTIVE_DAYS`         | LABOR      |             | HARD             | —              |
| `MAX_CONSECUTIVE_NIGHTS`       | LABOR      |      ✓      | HARD             | HC-007         |
| `FORBIDDEN_CODE_SEQUENCE`      | LABOR      |      ✓      | HARD             | HC-008         |
| `REQUIRED_COVERAGE`            | COVERAGE   |      ✓      | HARD             | HC-004         |
| `REQUIRED_COMPETENCY_IN_SHIFT` | COMPETENCY |      ✓      | HARD             | HC-003         |
| `GRADE_CODE_WHITELIST`         | COMPETENCY |             | HARD             | HC-003         |
| `FAIR_DISTRIBUTION`            | FAIRNESS   |             | SOFT             | SC-001/002/007 |
| `DAY_OFF_QUOTA`                | LABOR      |             | HARD             | HC-010         |
| `MAX_STAFF_OFF_PER_DAY`        | COVERAGE   |             | HARD             | HC-011         |
| `OT_LIMIT`                     | LABOR      |      ✓      | HARD             | HC-012         |
| `PREFERRED_PATTERN`            | PATTERN    |             | SOFT             | SC-004         |

Engine invariants (ไม่ใช่ template): `NO_TIME_OVERLAP`, `APPROVED_LEAVE_BLOCK`, `UNCONFIRMED_CODE_BLOCKED`, `MIDNIGHT_INTEGRITY`

---

## 5. TypeScript Registry Interface (implement)

```typescript
// src/domain/rules/registry.ts — สัญญา implement หลัง scaffold

import type { z } from "zod";

type RuleCategory = "SAFETY" | "LABOR" | "COVERAGE" | "COMPETENCY" | "FAIRNESS" | "PATTERN";

type RuleSeverity = "HARD" | "SOFT";

type OverrideClass = "NEVER" | "APPROVER_REQUIRED" | "SCHEDULER_ALLOWED";

interface RuleTemplateDefinition<TParams extends z.ZodType> {
  id: string;
  displayNameTh: string;
  descriptionTh: string;
  category: RuleCategory;
  paramSchema: TParams;
  defaultParams: z.infer<TParams>;
  defaultSeverity: RuleSeverity;
  allowedSeverities: readonly RuleSeverity[];
  defaultOverrideClass: OverrideClass;
  allowedOverrideClasses: readonly OverrideClass[];
  safetyLocked: boolean;
  constraintCatalogRef?: string;
  validatorKey: string;
}

// export const RULE_TEMPLATE_REGISTRY: Record<string, RuleTemplateDefinition<z.ZodType>>
// getRuleTemplate(id): RuleTemplateDefinition | undefined
// validateRuleParams(id, params): Result<unknown, ValidationError>
// applySafetyLocks(instance): RuleInstance — บังคับ severity/override ถ้า safetyLocked
```

---

## 6. Onboarding — Rule Instance เริ่มต้น

Import wizard อาจ **เสนอ** instance จากข้อมูลอดีต (ไม่ auto-enable):

| Template                       | แหล่งเสนอ              | เงื่อนไข                  |
| ------------------------------ | --------------------- | ----------------------- |
| `MIN_REST_BETWEEN_SHIFTS`      | min gap ที่พบในตารางเดิม | ผู้ใช้กดยืนยัน               |
| `FORBIDDEN_CODE_SEQUENCE`      | คู่ night→day ที่พบ       | ผู้ใช้กดยืนยัน               |
| `REQUIRED_COMPETENCY_IN_SHIFT` | เปิด default           | safety lock             |
| `REQUIRED_COVERAGE`            | จาก coverage form     | ต้องกรอก requirement ก่อน |

---

## 7. Change Log

| วันที่        | การเปลี่ยนแปลง                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-10 | สร้าง registry 10 template + 4 engine invariant; Zod schema และแม็ป constraint catalog                                                              |
| 2026-08-11 | อัปเดต FAIR_DISTRIBUTION (scope, toleranceHours, lookbackMonths, OT_HOURS); เพิ่ม DAY_OFF_QUOTA, MAX_STAFF_OFF_PER_DAY, OT_LIMIT สำหรับ solver สองระยะ |
