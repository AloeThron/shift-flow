# Constraint Catalog — แคตตалогกติกาการจัดเวร

> **สถานะ:** ร่างเริ่มต้น (Draft v0.1) — ต้อง sign-off จาก stakeholders ก่อน scaffold code  
> **Effective:** _กรอกหลัง Discovery Gate_  
> **Rule-set version:** `RSV-0.1-draft`

---

## 1. วิธีใช้เอกสาร

แต่ละ rule มี:

| ฟิลด์           | ความหมาย                                            |
| ------------- | --------------------------------------------------- |
| **ID**        | รหัส rule ถาวร                                       |
| **Source**    | SOP, HR policy, ISO, ข้อตกลง pilot                   |
| **Owner**     | ผู้รับผิดชอบอัปเดต                                       |
| **Class**     | `HARD` หรือ `SOFT`                                   |
| **Override**  | `NEVER` / `APPROVER_REQUIRED` / `SCHEDULER_ALLOWED` |
| **Effective** | วันเริ่มใช้                                             |
| **Validator** | ฟังก์ชันที่จะ implement (หลัง gate)                       |

**หลัก lexicographic:** ผลลัพธ์ที่มี HARD violation ห้ามถูกเลือกเพราะ SOFT score สูง

---

## 2. นิยามคำศัพท์ (Terminology — ต้อง sign-off)

| คำศัพท์              | นิยาม (ร่าง — แก้หลังสัมภาษณ์)                                                               | Owner     |
| ----------------- | -------------------------------------------------------------------------------------- | --------- |
| **ชั่วโมงงาน**      | เวลาของ assignment ที่อยู่ในเวลางาน ไม่นับ break ที่ไม่จ่าย (provisional)                        | HR        |
| **OT**            | ชั่วโมงที่เกินเป้าหมาย — จาก `ShiftCode.otHours` + `Assignment.plannedOtHours` (provisional) | HR        |
| **วันหยุด**         | วันหยุดตามปฏิทินองค์กรและวันหยุดนักขัตฤกษ์ (provisional)                                         | HR        |
| **เวรดึก**         | assignment ที่เริ่มช่วงกลางคืนหรือข้ามเที่ยงคืนตาม shift template (provisional)                   | Scheduler |
| **เวรต่อเนื่อง**     | assignment ติดกันจนพักระหว่างเวรไม่ถึง minimum rest                                          | Domain    |
| **ผู้มีอำนาจปฏิบัติงาน** | staff ที่มี competency authorization valid สำหรับ activity ตลอด assignment                  | Quality   |

---

## 3. Hard Constraints — ห้ามฝ่าฝืน (Override: NEVER)

### HC-001 — ไม่มี assignment ทับเวลา

| ฟิลด์                   | ค่า                                                    |
| --------------------- | ----------------------------------------------------- |
| **Source**            | Domain invariant                                      |
| **Owner**             | Scheduler + Lab Head                                  |
| **Class**             | HARD                                                  |
| **Override**          | NEVER                                                 |
| **Description**       | staff คนเดียวกันไม่มีสอง assignment ที่ overlap ในเวลา      |
| **Example violation** | STAFF-003 มีเวร 08:00–16:00 และ 14:00–22:00 ในวันเดียวกัน |
| **Cross-boundary**    | ตรวจ assignment ในรอบก่อน/หลัง schedule cycle           |

---

### HC-002 — Planned non-working day blocks assignment

| ฟิลด์                   | ค่า                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Source**            | `PlannedNonWorkingDay` + `NonWorkingDayKind.blocksScheduling` (Stage A / canvas)                            |
| **Owner**             | HR + Scheduler                                                                                              |
| **Class**             | HARD                                                                                                        |
| **Override**          | NEVER                                                                                                       |
| **Description**       | ไม่จัด assignment ให้ staff ในวันที่มี `PlannedNonWorkingDay` ชนิดที่ `blocksScheduling = true`                       |
| **Example violation** | จัดเวรให้ STAFF-007 วันที่ canvas ตั้ง `PLANNED_OFF` (ลาพักร้อน) ไว้แล้ว                                               |
| **Notes**             | ไม่มี entity `LeaveRequest` แยก — วันหยุด/ลาป้อนผ่าน canvas popup (`NonWorkingDayKind` ทุกชนิดที่ active) หรือ Stage A |

---

### HC-003 — Competency authorization valid

| ฟิลด์                    | ค่า                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Source**             | ISO 15189:2022, ART-POL-03                                                                                                        |
| **Owner**              | Quality                                                                                                                           |
| **Class**              | HARD                                                                                                                              |
| **Override**           | NEVER                                                                                                                             |
| **Description**        | ทุก assignment ที่ระบุ competency ต้องมี `StaffCompetencyAuthorization` valid ครอบคลุมทั้งช่วงเวร                                           |
| **Example violation**  | มอบหมาย hematology bench ให้ STAFF-002 ขณะ authorization หมดอายุก่อนจบเวร                                                            |
| **Notes**              | รวม supervision requirement ถ้า policy กำหนด                                                                                        |
| **Discovery evidence** | OCR 8 เดือน: MT ไม่เคยได้ `F/16`, `B/17`, `บด`; ผู้ช่วยไม่เคยได้ `N1`, `N2`, `INC`, `CH` → vocabulary แยกตาม grade สนับสนุน competency gate |

---

### HC-004 — Shift code demand ครบ

| ฟิลด์                    | ค่า                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**             | Lab SOP, ART-COV-01                                                                                                                    |
| **Owner**              | Lab Head                                                                                                                               |
| **Class**              | HARD                                                                                                                                   |
| **Override**           | NEVER (ยกเว้น emergency ที่มี approver — ดู EC-001)                                                                                         |
| **Description**        | ทุกรหัสเวรที่มี `ShiftCodeDemand` active ต้องมี headcount, competency และ lead ครบตาม demand — **ต่อรหัสเวร ไม่ใช่ช่วงเวลา×work area**             |
| **Example violation**  | รหัส `N1-MI` วันจันทร์ demand ≥ 1 คน + lead แต่มี 0 assignment ที่ map รหัสนี้                                                                    |
| **Discovery evidence** | **`MI` และ `IM` เป็น Department คนละตัว** (พบ ~76 vs ~59 ครั้ง) — demand/competency นับแยกแผนกผ่าน `ShiftCode.departmentId`; ห้ามยุบ alias OCR |

---

### HC-005 — Minimum rest between assignments

| ฟิลด์                | ค่า                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Source**         | HR policy — _กรอกชั่วโมงหลัง sign-off_                                                          |
| **Owner**          | HR                                                                                           |
| **Class**          | HARD                                                                                         |
| **Override**       | NEVER                                                                                        |
| **Parameter**      | `minRestHours = 11` (provisional จาก role play ผู้จัดเวร; รอ HR/นิติกร sign-off)                  |
| **Description**    | ระหว่าง end ของ assignment หนึ่งกับ start ของ assignment ถัดไปของ staff เดียวกัน ต้อง ≥ minRestHours |
| **Cross-boundary** | ใช้ assignment จากรอบก่อนหน้า                                                                   |

---

### HC-006 — Maximum rolling work hours

| ฟิลด์             | ค่า                                                                                    |
| --------------- | ------------------------------------------------------------------------------------- |
| **Source**      | HR policy                                                                             |
| **Owner**       | HR                                                                                    |
| **Class**       | HARD                                                                                  |
| **Override**    | NEVER                                                                                 |
| **Parameter**   | `rollingWindowHours = 24`, `maxHoursInWindow = 16` (provisional จาก role play ผู้จัดเวร) |
| **Description** | ชั่วโมงงานสะสมใน rolling window ไม่เกิน max                                               |

---

### HC-007 — Consecutive night shifts

| ฟิลด์             | ค่า                                                            |
| --------------- | ------------------------------------------------------------- |
| **Source**      | Lab SOP / HR                                                  |
| **Owner**       | Lab Head + HR                                                 |
| **Class**       | HARD                                                          |
| **Override**    | NEVER                                                         |
| **Parameter**   | `maxConsecutiveNights = 3` (provisional จาก role play ผู้จัดเวร) |
| **Description** | จำนวนเวรดึกติดกันสูงสุดต่อ staff                                     |

---

### HC-008 — Night-to-day transition

| ฟิลด์             | ค่า                                                                   |
| --------------- | -------------------------------------------------------------------- |
| **Source**      | HR / occupational health                                             |
| **Owner**       | HR                                                                   |
| **Class**       | HARD                                                                 |
| **Override**    | NEVER                                                                |
| **Parameter**   | `minRestAfterNightBeforeDay = 11` (provisional จาก role play ผู้จัดเวร) |
| **Description** | หลังเวรดึก ห้ามเริ่ม day shift เร็วกว่าที่กำหนด                                |

---

### HC-009 — Shift crosses midnight integrity

| ฟิลด์             | ค่า                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Source**      | Domain time model                                                                              |
| **Owner**       | Engineering (implement ตาม policy)                                                             |
| **Class**       | HARD                                                                                           |
| **Override**    | NEVER                                                                                          |
| **Description** | assignment ข้ามเที่ยงคืนต้องเก็บ instant UTC + local date ถูกต้อง; validator ใช้ instant ไม่ใช่ date-only |

---

### HC-010 — Day-off quota per cycle

| ฟิลด์                   | ค่า                                                                              |
| --------------------- | ------------------------------------------------------------------------------- |
| **Source**            | HR policy, ข้อตกลง pilot                                                         |
| **Owner**             | HR + Scheduler                                                                  |
| **Class**             | HARD (หรือ SOFT ตาม rule instance)                                               |
| **Override**          | APPROVER_REQUIRED                                                               |
| **Parameter**         | `daysOffPerCycle` / `daysOffPerWeek`, `minWeekendDaysOff` — จาก `DAY_OFF_QUOTA` |
| **Description**       | แต่ละ staff ต้องได้วันหยุดครบโควตาในรอบ — Stage A min-cost flow บังคับ supply = demand |
| **Example violation** | STAFF-004 ได้วันหยุด 6 วัน แต่โควตา 8 วัน → ขาด 2 วัน (infeasible หรือ soft gap)        |

---

### HC-011 — Maximum staff off per day (group capacity)

| ฟิลด์                   | ค่า                                                                              |
| --------------------- | ------------------------------------------------------------------------------- |
| **Source**            | Lab SOP — จำนวนคนหยุดพร้อมกันสูงสุดต่อกลุ่ม                                              |
| **Owner**             | Lab Head + Scheduler                                                            |
| **Class**             | HARD                                                                            |
| **Override**          | APPROVER_REQUIRED                                                               |
| **Parameter**         | `maxOffWeekday`, `maxOffWeekend`, `maxOffHoliday` — จาก `MAX_STAFF_OFF_PER_DAY` |
| **Description**       | แต่ละวันใน `StaffGroup` มีเพดานคนหยุดพร้อมกัน — capacity arc ใน Stage A               |
| **Example violation** | กลุ่ม bench A วันเสาร์หยุดพร้อมกัน 5 คน แต่เพดาน 4 คน                                   |

---

### HC-012 — Overtime limits per cycle

| ฟิลด์                   | ค่า                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------- |
| **Source**            | HR policy, กฎหมายแรงงาน                                                                  |
| **Owner**             | HR                                                                                       |
| **Class**             | HARD                                                                                     |
| **Override**          | NEVER                                                                                    |
| **Parameter**         | `maxOtHoursPerStaffPerCycle`, `maxOtHoursPerOrgPerCycle` — จาก `OT_LIMIT`                |
| **Description**       | จำกัด OT สะสมจาก `Assignment.plannedOtHours` + `ShiftCode.otHours` ไม่ให้เกลี่ย OT โดยไม่มีเพดาน |
| **Example violation** | STAFF-002 สะสม planned OT 24 ชม. แต่เพดาน 20 ชม. ต่อเดือน                                   |

---

## 4. Emergency / Controlled Override

### EC-001 — Emergency coverage gap (canvas override)

| ฟิลด์             | ค่า                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Source**      | Lab Head policy — ปฏิบัติผ่าน canvas popup                                                                |
| **Owner**       | Lab Head + Scheduler                                                                                  |
| **Class**       | HARD ที่อนุญาต bypass ชั่วคราวด้วย override มีเหตุผล                                                          |
| **Override**    | APPROVER_REQUIRED → ผู้จัดเวร (`SCHEDULER`) เลือก **Override ด้วยเหตุผล** ใน popup หรือตอน publish           |
| **Description** | เมื่อ demand ต่อรหัสเวรไม่ครบจริง ผู้จัดเวรมอบหมายรหัสที่ validator บล็อกได้โดยระบุเหตุผล — ไม่มี workflow อนุมัติแยก role |
| **Audit**       | `AuditEvent` action `OVERRIDE` / `PUBLISH` พร้อม `overrideReason`, `isManualOverride` บน `Assignment`  |
| **Example**     | เจ็บป่วยกะดึก — ผู้จัดเวร override HC-004 ด้วยเหตุผล "lone working 2 ชม. รอ callback" แล้ว publish             |

---

## 5. Soft Constraints — ปรับได้ด้วย weight

| ID     | คำอธิบาย                                                             | Weight (1–10) | Override                     | Owner     |
| ------ | ------------------------------------------------------------------ | :-----------: | ---------------------------- | --------- |
| SC-001 | ความเป็นธรรมเวรดึก — กระจายตาม FTE และ opportunity                   |       8       | SCHEDULER_ALLOWED            | Scheduler |
| SC-002 | ความเป็นธรรมวันหยุด/เสาร์-อาทิตย์                                        |       7       | SCHEDULER_ALLOWED            | Scheduler |
| SC-003 | ตอบ satisfaction ของ staff preference                              |       5       | SCHEDULER_ALLOWED            | Scheduler |
| SC-004 | Bench rotation — ไม่ติด bench เดิมเกิน N วันติด                          |       5       | SCHEDULER_ALLOWED            | Lab Head  |
| SC-005 | Competency recency — ใช้ skill ที่ practice ล่าสุด                      |       5       | SCHEDULER_ALLOWED            | Quality   |
| SC-006 | Schedule stability — ลดการเปลี่ยนจาก published ก่อนหน้า                |       7       | APPROVER_REQUIRED ถ้าเปลี่ยนมาก | Scheduler |
| SC-007 | ความสมดุลชั่วโมง/OT สะสมหลายรอบ (carry-over `fairnessLookbackMonths`) |       8       | SCHEDULER_ALLOWED            | HR        |

**Stage A / Stage B:** HC-010–HC-012 และ SC-001/002/007 ป้อนเข้า min-cost flow solver (ดู [optimization-model.md](./optimization-model.md), [scheduling-workflow.md](./scheduling-workflow.md))

**หมายเหตุ:** weight เป็นค่าเริ่มต้น — ปรับหลัง benchmark pilot

> Discovery evidence ของ HC-005–008 และน้ำหนัก SC-002–003 มาจาก role play ผู้จัดเวรเท่านั้น ยังเป็น provisional ต้องตรวจสอบกับ HR/นิติกร, Lab Head และ Quality ก่อนเปลี่ยนสถานะเป็น effective

---

## 6. Override Policy Matrix

| Override class    | ใครอนุมัติ                                | ต้องมี reason | ต้องมี expiry | ตัวอย่าง                                          |
| ----------------- | -------------------------------------- | :---------: | :---------: | ----------------------------------------------- |
| NEVER             | —                                      |      —      |      —      | overlap, expired competency                     |
| APPROVER_REQUIRED | ผู้จัดเวร (SCHEDULER) — บังคับเหตุผล + audit |     ใช่      |     ไม่      | emergency coverage, publish ทั้งที่มี hard violation |
| SCHEDULER_ALLOWED | ผู้จัดเวร (SCHEDULER)                     |  ใช่ (soft)  |     ไม่      | preference trade-off                            |

---

## 7. Rule Sources และ Traceability

| Source ID    | เอกสาร               | วันที่มีผล | เก็บที่               |
| ------------ | -------------------- | ------ | ------------------ |
| SRC-HR-01    | นโยบายเวลางาน/OT     |        | ART-POL-02         |
| SRC-QA-01    | Competence SOP       |        | ART-POL-03         |
| SRC-LAB-01   | SOP จัดเวร            |        | ART-POL-01         |
| SRC-PILOT-01 | ข้อตกลง pilot หน่วยงาน |        | Discovery sign-off |

---

## 8. ตัวอย่างสถานการณ์ (Scenarios)

### Scenario A — Cross-midnight + rest

- STAFF-005 จบเวรดึก 06:00 วันที่ 15
- มี day shift 14:00 วันที่ 15
- ตรวจ HC-005: rest = 8 ชม. ถ้า minRestHours = 11 → **violation**

### Scenario B — Competency หมดกลางเวร

- Authorization หมด 2026-08-10 23:59
- Assignment 22:00–06:00 เริ่ม 2026-08-10 → **violation** (ไม่ครอบคลุมทั้งช่วง)

### Scenario C — Soft trade-off

- STAFF-001 ขอไม่ขึ้นเวรดึก (preference)
- ไม่มีคนอื่น valid competency → ต้อง assign STAFF-001
- บันทึก SC-003 ไม่ satisfied ใน draft explanation

### Scenario D — Stage A แล้วล็อกวันหยุด

- Stage A มอบวันหยุด STAFF-003 วันเสาร์ที่ 12 และ 19
- ผู้จัดเวรล็อก (`PlannedNonWorkingDay.locked = true`)
- Stage B เกลี่ยงาน — solver **ห้าม** เปลี่ยนวันหยุดที่ล็อก แม้ coverage จะ tight

### Scenario E — Planned OT เกินเพดาน

- STAFF-006 มี assignment ที่ `plannedOtHours` รวม 22 ชม.
- `OT_LIMIT.maxOtHoursPerStaffPerCycle = 20` → **violation** HC-012

---

## 9. Discovery Gate — Sign-off

| Rule section        | Scheduler | Lab Head | HR/Legal | Quality |  DPO  |
| ------------------- | :-------: | :------: | :------: | :-----: | :---: |
| Terminology §2      |     ☐     |    ☐     |    ☐     |    ☐    |   ☐   |
| Hard constraints §3 |     ☐     |    ☐     |    ☐     |    ☐    |   ☐   |
| Soft constraints §5 |     ☐     |    ☐     |    ☐     |    ☐    |   ☐   |
| Override matrix §6  |     ☐     |    ☐     |    ☐     |    ☐    |   ☐   |

**วันที่ sign-off:** ___________  
**Rule-set version ถัดไป:** `RSV-1.0`

---

## 10. Change Log

| วันที่        | Version       | การเปลี่ยนแปลง                                                                                 | ผู้อนุมัติ     |
| ---------- | ------------- | -------------------------------------------------------------------------------------------- | --------- |
| 2026-08-10 | RSV-0.1-draft | สร้างร่างเริ่มต้นจากแผน Discovery                                                                 | —         |
| 2026-08-10 | RSV-0.1-draft | เพิ่ม provisional values จาก role play ผู้จัดเวร; ยังไม่ใช่ sign-off                                 | รอยืนยัน    |
| 2026-08-10 | RSV-0.1-draft | เพิ่มหลักฐาน OCR ใน HC-003/HC-004: vocabulary แยก grade + MI/IM แยก WorkArea; ไม่เปลี่ยน parameter | Discovery |
| 2026-08-11 | RSV-0.1-draft | เพิ่ม HC-010–HC-012 (วันหยุด, เพดานหยุดพร้อมกัน, OT); อัปเดต SC-007 carry-over; scenarios Stage A/B  | —         |
| 2026-08-11 | RSV-0.1-draft | HC-002 อ้าง `PlannedNonWorkingDay`; EC-001 override ใน popup + audit (two-role)               | —         |
| 2026-08-11 | RSV-0.1-draft | HC-004 อ้าง `ShiftCodeDemand` ต่อรหัสเวร (แทน coverage window×area); MI/IM → Department         | —         |
