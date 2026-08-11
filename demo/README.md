# Synthetic Demo Data / ข้อมูลสังเคราะห์

ชุดข้อมูลนี้ใช้สำหรับ **ทดสอบ config model, validator และ regression fixtures** — ไม่มี PII และไม่ map กับ `pilot-vault/`

> **คำเตือน:** ทุก starter pack เป็นตัวอย่าง ต้องให้ admin องค์กรตรวจและปรับก่อนใช้งานจริง

---

## Starter Packs

| โฟลเดอร์                                                                | กลุ่มเป้าหมาย               | ความซับซ้อน                            |
| ---------------------------------------------------------------------- | ------------------------ | ------------------------------------ |
| [`starter-packs/pilot-lab-example/`](starter-packs/pilot-lab-example/) | Pilot Pattern Laboratory | สูง — หลาย bench + night codes (สมมติ) |

## Validation Dataset (นิรนามจาก Pilot)

| โฟลเดอร์                                      | กลุ่มเป้าหมาย                   | หมายเหตุ                                                          |
| -------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| [`validation-dataset/`](validation-dataset/) | regression / golden fixtures | export จาก `pilot-vault/anonymized/` — **ไม่** ใช้ seed/onboarding |

Regenerate: `pnpm fixtures:export` (หลัง `python scripts/build_roster_artifacts.py`)

---

## ไฟล์มาตรฐานต่อ pack

| ไฟล์                             | คำอธิบาย                                           |
| ------------------------------- | ------------------------------------------------ |
| `README.md`                     | บริบท pack และข้อจำกัด                               |
| `organization.yaml`             | metadata องค์กร (ชื่อสมมติ, timezone)                |
| `work_areas.csv`                | WorkArea / bench                                 |
| `staff_grades.csv`              | ระดับพนักงาน                                       |
| `shift_codes.csv`               | รหัสเวร canonical                                 |
| `staff.csv`                     | บุคลากรสังเคราะห์                                   |
| `staff_shift_authorization.csv` | สิทธิปฏิบัติงานตามรหัสเวร                              |
| `shift_demands.csv`             | ความต้องการกำลังคนขั้นต่ำต่อรหัสเวร                       |
| `holidays.csv`                  | วันหยุดตัวอย่าง                                      |
| `rule_instances.yaml`           | rule instance เริ่มต้น                              |
| `roster_import_sample.csv`      | ตัวอย่างเซลล์ดิบสำหรับ regression parser (ไม่มี UI นำเข้า) |
| `roster_month_sample.csv`       | ตารางเวรเดือนเต็ม (optional) — publish หลัง apply   |

---

## CSV Schema

### work_areas.csv

```csv
code,display_name_th,display_name_en,department_code,sort_order,active
```

### staff_grades.csv

```csv
code,display_name_th,sort_order,can_work_nights
```

### shift_codes.csv

```csv
canonical_code,work_area_code,start_time,end_time,standard_hours,staff_grade_codes,needs_confirmation,active
```

- `staff_grade_codes`: คั่นด้วย `|` เช่น `MT|PT`
- `start_time` / `end_time`: `HH:MM` (24h, local org timezone)

### staff.csv

```csv
staff_code,display_name,grade_code,staff_group_code,staff_group_section,row_order,email,fte,contract_type,active
```

- `staff_group_section`: `RESULT_CAPABLE` | `RESULT_NOT_CAPABLE` | `PART_TIME`
- `contract_type`: `FULL_TIME` | `PART_TIME` | `NO_GUARANTEED_HOURS`
- `email`: สมมติ `@demo.shift-flow.local` เท่านั้น

### staff_shift_authorization.csv

```csv
staff_code,shift_code,level,authorized_date,expiry_date,authorizer_staff_code
```

- `shift_code`: ว่าง = สิทธิทุกรหัสเวร (`coversAllShiftCodes`)
- `level`: `TRAINEE` | `AUTHORIZED` | `LEAD`
- `expiry_date`: ว่าง = ไม่หมดอายุ
- วันที่: `YYYY-MM-DD`

### shift_demands.csv

```csv
canonical_code,day_type,min_count,requires_lead
```

- `day_type`: `WEEKDAY` | `WEEKEND` | `HOLIDAY` | `ALL`

### holidays.csv

```csv
local_date,name_th,name_en
```

### roster_import_sample.csv

```csv
staff_code,local_date,raw_code,notes
```

- `raw_code`: token ดิบก่อน map — รวม `off`, `?`, alias

### roster_month_sample.csv

```csv
staff_code,local_date,canonical_code,notes
```

- ตารางเวรเดือนเต็ม (long format) สำหรับ seed / นำเข้าชุดตัวอย่าง
- `canonical_code` ต้องตรง `shift_codes.csv` (ไม่ใช่ alias)
- apply pack จะ publish แล้วดูตารางได้ที่ `/schedule`

---

## การใช้งาน

1. **Seed / dev:** `pnpm db:seed` (default `pilot-lab-example`; เปลี่ยนได้ด้วย `SEED_STARTER_PACK`)
2. **UI:** `/settings` → นำเข้าชุดตั้งต้นสังเคราะห์ (SYSTEM_ADMIN; แทนที่ config + publish ตารางเดือนตัวอย่าง)
3. **ดูตาราง:** `/schedule` — canvas จัดเวรทั้งแผนก

**หมายเหตุ:** ไม่มี Import wizard ในแอป — ทางสร้างตารางตัวอย่างคือ starter pack ที่ `/settings`; validation dataset ใช้ `pnpm fixtures:export` สำหรับ OCR regression (`parse_shift_tokens.json`)

---

## นโยบายข้อมูล

1. **ห้าม** แทนที่ด้วยข้อมูลจาก `pilot-vault/` — ใช้ [`validation-dataset/`](validation-dataset/) สำหรับ regression แทน
2. ชื่อบุคลากรใช้รูปแบบ `Demo Staff NN` หรือชื่อสมมติที่ไม่ซ้ำกับหน้างานจริง
3. รหัส `STAFF-DEMO-*` ไม่ overlap กับ anonymized id ใน vault
4. อัปเดต pack เมื่อ schema ใน [`docs/domain/configuration-model.md`](../docs/domain/configuration-model.md) เปลี่ยน
