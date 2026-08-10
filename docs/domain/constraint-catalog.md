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

| คำศัพท์              | นิยาม (ร่าง — แก้หลังสัมภาษณ์)                                 | Owner     |
| ----------------- | -------------------------------------------------------- | --------- |
| **ชั่วโมงงาน**      | เวลาทำงานที่นับตามสัญญา ไม่รวม break ที่ไม่จ่าย                    | HR        |
| **OT**            | ชั่วโมงเกินกว่าที่ policy/สัญญากำหนด                             | HR        |
| **วันหยุด**         | วันหยุดตามปฏิทินหน่วยงาน + นักขัตฤกษ์                            | HR        |
| **เวรดึก**         | กะที่ _กรอกเวลาเริ่ม–จบ_ ตาม shift template                  | Scheduler |
| **เวรต่อเนื่อง**     | assignment ติดกันโดยไม่มีช่วงพัก ≥ min rest                    | Domain    |
| **ผู้มีอำนาจปฏิบัติงาน** | staff ที่มี competency authorization valid สำหรับ activity นั้น | Quality   |

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

### HC-002 — Approved leave / hard unavailability

| ฟิลด์                   | ค่า                                                                  |
| --------------------- | ------------------------------------------------------------------- |
| **Source**            | HR leave policy, ART-POL-02                                         |
| **Owner**             | HR                                                                  |
| **Class**             | HARD                                                                |
| **Override**          | NEVER                                                               |
| **Description**       | ไม่จัดเวรให้ staff ที่มี approved leave หรือ hard unavailability ทับช่วงเวลา |
| **Example violation** | จัดเวรให้ STAFF-007 วันที่มีลาพักร้อน approved ทั้งวัน                         |

---

### HC-003 — Competency authorization valid

| ฟิลด์                   | ค่า                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------- |
| **Source**            | ISO 15189:2022, ART-POL-03                                                              |
| **Owner**             | Quality                                                                                 |
| **Class**             | HARD                                                                                    |
| **Override**          | NEVER                                                                                   |
| **Description**       | ทุก assignment ที่ระบุ competency ต้องมี `StaffCompetencyAuthorization` valid ครอบคลุมทั้งช่วงเวร |
| **Example violation** | มอบหมาย hematology bench ให้ STAFF-002 ขณะ authorization หมดอายุก่อนจบเวร                  |
| **Notes**             | รวม supervision requirement ถ้า policy กำหนด                                              |

---

### HC-004 — Coverage requirement ครบ

| ฟิลด์                   | ค่า                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Source**            | Lab SOP, ART-COV-01                                                                  |
| **Owner**             | Lab Head                                                                             |
| **Class**             | HARD                                                                                 |
| **Override**          | NEVER (ยกเว้น emergency ที่มี approver — ดู EC-001)                                       |
| **Description**       | ทุกช่วงเวลาและ work area ต้องมี headcount, competency และ lead ตาม `CoverageRequirement` |
| **Example violation** | bench chemistry 22:00–06:00 ต้องมี 2 คน + 1 lead แต่มี 1 คน                              |

---

### HC-005 — Minimum rest between assignments

| ฟิลด์                | ค่า                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Source**         | HR policy — _กรอกชั่วโมงหลัง sign-off_                                                          |
| **Owner**          | HR                                                                                           |
| **Class**          | HARD                                                                                         |
| **Override**       | NEVER                                                                                        |
| **Parameter**      | `minRestHours = ___` (default placeholder: 11)                                               |
| **Description**    | ระหว่าง end ของ assignment หนึ่งกับ start ของ assignment ถัดไปของ staff เดียวกัน ต้อง ≥ minRestHours |
| **Cross-boundary** | ใช้ assignment จากรอบก่อนหน้า                                                                   |

---

### HC-006 — Maximum rolling work hours

| ฟิลด์             | ค่า                                                  |
| --------------- | --------------------------------------------------- |
| **Source**      | HR policy                                           |
| **Owner**       | HR                                                  |
| **Class**       | HARD                                                |
| **Override**    | NEVER                                               |
| **Parameter**   | `rollingWindowHours = 24`, `maxHoursInWindow = ___` |
| **Description** | ชั่วโมงงานสะสมใน rolling window ไม่เกิน max             |

---

### HC-007 — Consecutive night shifts

| ฟิลด์             | ค่า                           |
| --------------- | ---------------------------- |
| **Source**      | Lab SOP / HR                 |
| **Owner**       | Lab Head + HR                |
| **Class**       | HARD                         |
| **Override**    | NEVER                        |
| **Parameter**   | `maxConsecutiveNights = ___` |
| **Description** | จำนวนเวรดึกติดกันสูงสุดต่อ staff    |

---

### HC-008 — Night-to-day transition

| ฟิลด์             | ค่า                                    |
| --------------- | ------------------------------------- |
| **Source**      | HR / occupational health              |
| **Owner**       | HR                                    |
| **Class**       | HARD                                  |
| **Override**    | NEVER                                 |
| **Parameter**   | `minRestAfterNightBeforeDay = ___`    |
| **Description** | หลังเวรดึก ห้ามเริ่ม day shift เร็วกว่าที่กำหนด |

---

### HC-009 — Shift crosses midnight integrity

| ฟิลด์             | ค่า                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Source**      | Domain time model                                                                              |
| **Owner**       | Engineering (implement ตาม policy)                                                             |
| **Class**       | HARD                                                                                           |
| **Override**    | NEVER                                                                                          |
| **Description** | assignment ข้ามเที่ยงคืนต้องเก็บ instant UTC + local date ถูกต้อง; validator ใช้ instant ไม่ใช้ date-only |

---

## 4. Emergency / Controlled Override

### EC-001 — Emergency coverage gap

| ฟิลด์             | ค่า                                                                       |
| --------------- | ------------------------------------------------------------------------ |
| **Source**      | Lab Head policy                                                          |
| **Owner**       | Lab Head                                                                 |
| **Class**       | HARD ที่อนุญาต bypass ชั่วคราว                                                |
| **Override**    | APPROVER_REQUIRED                                                        |
| **Description** | เมื่อ coverage ไม่ครบจริง อนุญาต override HC-004 ได้ด้วยเหตุผล, approver, expiry |
| **Audit**       | บันทึกใน safety report และ AuditEvent                                      |
| **Example**     | เจ็บป่วยกะดึก — Lab Head อนุมัติ lone working 2 ชม. พร้อม callback              |

---

## 5. Soft Constraints — ปรับได้ด้วย weight

| ID     | คำอธิบาย                                              | Weight (1–10) | Override                     | Owner     |
| ------ | --------------------------------------------------- | :-----------: | ---------------------------- | --------- |
| SC-001 | ความเป็นธรรมเวรดึก — กระจายตาม FTE และ opportunity    |       8       | SCHEDULER_ALLOWED            | Scheduler |
| SC-002 | ความเป็นธรรมวันหยุด/เสาร์-อาทิตย์                         |       8       | SCHEDULER_ALLOWED            | Scheduler |
| SC-003 | ตอบ satisfaction ของ staff preference               |       6       | SCHEDULER_ALLOWED            | Scheduler |
| SC-004 | Bench rotation — ไม่ติด bench เดิมเกิน N วันติด           |       5       | SCHEDULER_ALLOWED            | Lab Head  |
| SC-005 | Competency recency — ใช้ skill ที่ practice ล่าสุด       |       5       | SCHEDULER_ALLOWED            | Quality   |
| SC-006 | Schedule stability — ลดการเปลี่ยนจาก published ก่อนหน้า |       7       | APPROVER_REQUIRED ถ้าเปลี่ยนมาก | Scheduler |
| SC-007 | ความสมดุลชั่วโมงสะสมหลายรอบ (ไม่ reset ทุกเดือน)          |       8       | SCHEDULER_ALLOWED            | HR        |

**หมายเหตุ:** weight เป็นค่าเริ่มต้น — ปรับหลัง benchmark pilot

---

## 6. Override Policy Matrix

| Override class    | ใครอนุมัติ                 | ต้องมี reason | ต้องมี expiry | ตัวอย่าง                              |
| ----------------- | ----------------------- | :---------: | :---------: | ----------------------------------- |
| NEVER             | —                       |      —      |      —      | overlap, expired competency         |
| APPROVER_REQUIRED | Lab Head (หรือ delegate) |     ใช่      |    แนะนำ     | emergency coverage, stability break |
| SCHEDULER_ALLOWED | Scheduler               |  ใช่ (soft)  |     ไม่      | preference trade-off                |

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

| วันที่        | Version       | การเปลี่ยนแปลง                 | ผู้อนุมัติ |
| ---------- | ------------- | ---------------------------- | ----- |
| 2026-08-10 | RSV-0.1-draft | สร้างร่างเริ่มต้นจากแผน Discovery | —     |
