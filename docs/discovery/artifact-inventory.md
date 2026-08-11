# Artifact Inventory — รายการเอกสารและไฟล์จากหน้างาน

> **สำคัญ:** เก็บไฟล์ดิบนอก repo จน anonymize แล้ว  
> ใส่เฉพาะ metadata และโครงสร้างใน repo นี้

---

## 1. วัตถุประสงค์

บันทึกว่าหน่วยงานใช้ artifact ใดในการจัดเวร เพื่อออกแบบ import template, constraint และ baseline โดยไม่ commit ข้อมูลส่วนบุคคล

---

## 2. สถานะการเก็บ / Collection Status

| สถานะ                | ความหมาย                                               |
| -------------------- | ------------------------------------------------------ |
| ☐ ยังไม่ขอ             | ยังไม่ได้ร้องขอจากหน่วยงาน                                  |
| ◐ ได้รับแล้ว (off-repo) | เก็บใน encrypted storage ของ pilot                      |
| ✓ Anonymized         | พร้อมใส่ `demo/validation-dataset/` หรือ fixture (ถ้าอนุมัติ) |
| ✗ ไม่มี                | หน่วยงานไม่มี artifact ประเภทนี้                            |

---

## 3. รายการ Artifact หลัก

### 3.1 ตารางเวร / Roster

| ID                | ชื่อไฟล์ (นิรนาม)             | รูปแบบ | ครอบคลุมช่วง     | สถานะ | หมายเหตุ                       |
| ----------------- | ------------------------- | ----- | -------------- | ----- | ----------------------------- |
| ART-ROST-01       | roster_cycle_N-2.xlsx     | Excel | รอบ N-2        | ☐     | ต้องมีเวรก่อน boundary           |
| ART-ROST-02       | roster_cycle_N-1.xlsx     | Excel | รอบ N-1        | ☐     | รอบล่าสุดที่ publish              |
| ART-ROST-03       | roster_cycle_N_draft.xlsx | Excel | รอบปัจจุบัน       | ☐     | draft ถ้ามี                     |
| ART-ROST-PHOTO-01 | S__21069857_0.jpg         | JPG   | ม.ค. 2569      | ◐     | vault/raw/ART-ROST-PHOTO-SET/ |
| ART-ROST-PHOTO-02 | S__21069858_0.jpg         | JPG   | ก.พ. 2569      | ◐     | vault/raw/ART-ROST-PHOTO-SET/ |
| ART-ROST-PHOTO-03 | S__21069856_0.jpg         | JPG   | มี.ค. 2569      | ◐     | re-OCR 2026-08-10             |
| ART-ROST-PHOTO-04 | S__21069852_0.jpg         | JPG   | เม.ย. 2569 (1) | ◐     | vault/raw/ART-ROST-PHOTO-SET/ |
| ART-ROST-PHOTO-05 | S__21069855_0.jpg         | JPG   | เม.ย. 2569 (2) | ◐     | vault/raw/ART-ROST-PHOTO-SET/ |
| ART-ROST-PHOTO-06 | S__21069853_0.jpg         | JPG   | พ.ค. 2569      | ◐     | re-OCR 2026-08-10             |
| ART-ROST-PHOTO-07 | S__21069854_0.jpg         | JPG   | มิ.ย. 2569      | ◐     | vault/raw/ART-ROST-PHOTO-SET/ |
| ART-ROST-PHOTO-08 | S__21069860.jpg           | JPG   | ส.ค. 2566      | ◐     | re-OCR 2026-08-10             |
| ART-OT-01         | 3942F9C6-…jpg             | JPG   | OT พ.ค. 2569   | ◐     | vault/raw/ART-ROST-PHOTO-SET/ |

**ฟิลด์ที่สังเกตจากภาพตาราง (กรอกแล้ว — 2026-08-10):**

| ฟิลด์               |    มีในไฟล์    | ชื่อคอลัมน์จริง (blur ใน repo) | map ไป Shift-Flow             |
| ----------------- | :----------: | ------------------------- | ----------------------------- |
| รหัสพนักงาน         |      ✓       | รหัส (6 หลัก)               | StaffProfile.code → STAFF-xxx |
| ชื่อ                |      ✓       | พนักงาน                    | (display name — จำกัดสิทธิ์)       |
| กลุ่ม/grade         |      ✓       | หัวหน้า/MT/PT/ผู้ช่วย          | StaffGrade                    |
| วันที่               |      ✓       | คอลัมน์ 1–31                | local schedule date           |
| กะ/เวร            |      ✓       | รหัสในเซลล์                 | ShiftCode → ShiftInstance     |
| bench/area        | ✓ (ใน token) | MI, IM, BB, …             | WorkArea (**MI/IM แยก**)      |
| เวลา hint         |  ✓ (บางรหัส)  | 7BB, MI20, F/16           | ShiftTemplate start/end       |
| competency ที่ต้องใช้ |      ✗       | —                         | infer จาก WorkArea + grade    |
| หมายเหตุ           |      ✗       | —                         | —                             |
| สีแดงบนกระดาษ      |  ✓ (marker)  | —                         | **ไม่ map** (UNKNOWN)          |

---

### 3.2 รายชื่อบุคลากรและ FTE

| ID           | ชื่อไฟล์              | รูปแบบ | สถานะ | หมายเหตุ                        |
| ------------ | ------------------ | ----- | ----- | ------------------------------ |
| ART-STAFF-01 | staff_master.xlsx  | Excel | ☐     | จาก HR                         |
| ART-STAFF-02 | contract_types.pdf | PDF   | ☐     | ประเภทสัญญา (ไม่ commit ถ้ามี PII) |

**ฟิลด์สำคัญ:**

- FTE / ชั่วโมงเป้าหมาย
- ประเภทสัญญา
- effective start/end
- department / default work area

---

### 3.3 Competency / Authorization

| ID          | ชื่อไฟล์                  | รูปแบบ | สถานะ | หมายเหตุ                     |
| ----------- | ---------------------- | ----- | ----- | --------------------------- |
| ART-COMP-01 | competency_matrix.xlsx | Excel | ☐     |                             |
| ART-COMP-02 | authorization_log.xlsx | Excel | ☐     | approver, วันที่ประเมิน, หมดอายุ |
| ART-COMP-03 | iso_competence_sop.pdf | PDF   | ☐     | อ้างอิง rule source           |

---

### 3.4 Availability, Leave และ Swap

| ID           | ชื่อไฟล์                    | รูปแบบ    | สถานะ | หมายเหตุ                |
| ------------ | ------------------------ | -------- | ----- | ---------------------- |
| ART-LEAV-01  | leave_form_template.docx | Word/PDF | ☐     | ดูว่ามีช่อง sensitive อะไร |
| ART-LEAV-02  | leave_register_YYYY.xlsx | Excel    | ☐     | anonymize ชื่อ           |
| ART-AVAIL-01 | availability_survey.xlsx | Excel    | ☐     | แบบสำรวจก่อนจัดรอบ        |
| ART-SWAP-01  | swap_request_log.xlsx    | Excel    | ☐     | ถ้ามี                    |

**ตรวจสอบ privacy:**

- [ ] แบบฟอร์มลามีช่องอาการ/การวินิจฉัยหรือไม่ → ต้อง **ไม่** นำเข้าระบบ
- [ ] มีเลขที่ใบรับรองแพทย์หรือไม่ → เก็บนอกระบบเวร

---

### 3.5 ปฏิทินวันหยุดและกะมาตรฐาน

| ID           | ชื่อไฟล์                      | รูปแบบ | สถานะ | หมายเหตุ                    |
| ------------ | -------------------------- | ----- | ----- | -------------------------- |
| ART-HOL-01   | holiday_calendar_YYYY.xlsx | Excel | ☐     | รวม substitute             |
| ART-SHIFT-01 | shift_templates.xlsx       | Excel | ☐     | เวลาเริ่ม–จบ, ข้ามเที่ยงคืน      |
| ART-COV-01   | coverage_rules.xlsx        | Excel | ☐     | min headcount ต่อ area/time |

---

### 3.6 สูตรค่าตอบแทน / Payroll (อ้างอิง — phase หลัง)

| ID         | ชื่อไฟล์                       | รูปแบบ | สถานะ | หมายเหตุ                                     |
| ---------- | --------------------------- | ----- | ----- | ------------------------------------------- |
| ART-PAY-01 | ot_calculation.xlsx         | Excel | ☐     | สูตร OT — ไม่ commit secret rate ถ้า sensitive |
| ART-PAY-02 | night_weekend_allowance.pdf | PDF   | ☐     | นโยบาย HR                                   |

---

### 3.7 นโยบายและ SOP

| ID         | เอกสาร                    | Owner    | สถานะ | ใช้เป็น source ของ rule |
| ---------- | ------------------------- | -------- | ----- | --------------------- |
| ART-POL-01 | SOP การจัดเวรแล็บ           | Lab Head | ☐     |                       |
| ART-POL-02 | นโยบายเวลางาน/OT          | HR       | ☐     |                       |
| ART-POL-03 | ข้อกำหนด competence ISO     | Quality  | ☐     |                       |
| ART-POL-04 | PDPA / IT security policy | DPO      | ☐     |                       |

---

## 4. Anonymization Checklist

ก่อนนำตัวอย่างเข้า repo หรือแชร์ในทีม OSS:

- [ ] แทนที่ชื่อด้วย `STAFF-001`, `STAFF-002`, …
- [ ] ลบ/แทนที่รหัสพนักงานจริง, เบอร์โทร, email
- [ ] ลบข้อมูลผู้ป่วย, รหัส lab order, ผลตรวจ
- [ ] ลบ/ generalize วันที่ที่ระบุตัวตนได้ (ถ้าจำเป็น shift ± random offset)
- [ ] blur โลโก้/ชื่อโรงพยาบาลใน screenshot
- [ ] บันทึกวิธี anonymize ใน commit message หรือ README ของ sample

---

## 5. โครงสร้างเก็บ off-repo

โฟลเดอร์ [`pilot-vault/`](../../pilot-vault/) ถูกเตรียมไว้แล้วใน repo (โครงสร้าง + README) — เนื้อหาไฟล์จริง **ไม่ commit**

```
pilot-vault/
├── raw/                        # ไฟล์ดิบจากหน่วยงาน
├── anonymized/                 # หลัง anonymize
├── consent/                    # consent สัมภาษณ์ / ส่งมอบไฟล์
├── manifest.json               # คัดลอกจาก manifest.example.json — ไม่ commit
└── README.md                   # คู่มือใช้งาน
```

เมื่อได้รับ artifact: อัปเดตตาราง §3 สถานะเป็น `◐` และเพิ่มรายการใน `manifest.json`

---

## 6. Mapping ไปยัง Import Template (หลัง Discovery Gate)

| Artifact            | CSV template ที่จะสร้าง        | Priority |
| ------------------- | --------------------------- | -------- |
| staff_master        | `staff_import.csv`          | P0       |
| competency_matrix   | `competency_import.csv`     | P0       |
| holiday_calendar    | `holiday_import.csv`        | P0       |
| shift_templates     | `shift_template_import.csv` | P0       |
| roster เก่า          | `assignment_import.csv`     | P1       |
| availability_survey | `availability_import.csv`   | P1       |

---

## 7. Change Log

| วันที่        | Artifact ID        | การเปลี่ยนแปลง                                     | ผู้บันทึก     |
| ---------- | ------------------ | ------------------------------------------------ | --------- |
| 2026-08-10 | ART-ROST-PHOTO-*   | เพิ่มชุดภาพตาราง 8 เดือน + OT; กรอก §3.1             | Discovery |
| 2026-08-10 | ART-ROST-PHOTO-SET | ปิด temp/; raw → vault; export validation-dataset | Discovery |
|            |                    | สร้าง inventory เริ่มต้น                             |           |
