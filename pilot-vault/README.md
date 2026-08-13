# Pilot Vault — ที่เก็บไฟล์จากหน้างาน

> โฟลเดอร์นี้อยู่ **local / encrypted storage ของโรงพยาบาล**  
> เนื้อหาใน `raw/`, `anonymized/`, `consent/` และ `manifest.json` **ไม่ถูก commit** ลง git

---

## โครงสร้าง

```
pilot-vault/
├── README.md                 # คู่มือนี้ (commit ได้)
├── manifest.example.json     # แม่แบบ manifest (commit ได้)
├── manifest.json             # บันทึกไฟล์จริงที่เก็บ (ไม่ commit)
├── raw/                      # ไฟล์ดิบจากหน่วยงาน — มีชื่อจริงได้
│   └── ART-ROST-PHOTO-SET/   # JPG + csv/md transcript ชุดตารางเวร 8 เดือน + OT
├── anonymized/               # ไฟล์หลัง anonymize แล้ว
└── consent/                  # consent form / บันทึกการยินยอมสัมภาษณ์
```

---

## วิธีใช้

### 1. รับไฟล์จากหน่วยงาน

1. คัดลอกไฟล์ไป `raw/` ตั้งชื่อตาม [artifact-inventory.md](../docs/discovery/artifact-inventory.md) เช่น `ART-ROST-02_roster_cycle_N-1.xlsx`
2. อัปเดต `manifest.json` (คัดลอกจาก `manifest.example.json`)
3. อัปเดตสถานะใน `docs/discovery/artifact-inventory.md` เป็น `◐ ได้รับแล้ว (off-repo)`

### 2. Anonymize

ทำตาม checklist ใน artifact-inventory §4 แล้วเก็บผลลัพธ์ใน `anonymized/`:

- แทนชื่อด้วย `STAFF-001`, `STAFF-002`, …
- ลบรหัสพนักงานจริง, เบอร์, email
- blur โลโก้ใน screenshot

อัปเดต manifest สถานะเป็น `anonymized` และวันที่ anonymize

### 3. Consent

เก็บ consent สัมภาษณ์/ส่งมอบไฟล์ใน `consent/`:

```
consent/
├── INT-SCH-001-consent.pdf
└── ART-ROST-02-handover.pdf
```

---

## ความสัมพันธ์กับ repo

| ข้อมูล                 | เก็บที่                                                             |
| -------------------- | ---------------------------------------------------------------- |
| ไฟล์ Excel/PDF ดิบ     | `pilot-vault/raw/`                                               |
| ไฟล์นิรนาม             | `pilot-vault/anonymized/`                                        |
| metadata / checklist | `docs/discovery/artifact-inventory.md`                           |
| backlog คำถามหน้างาน   | `docs/discovery/clarification-requests.md`                       |
| กติกาที่ยืนยัน            | `docs/domain/constraint-catalog.md`                              |
| ตัวชี้วัด go-live        | รายงาน JSON ตาม `src/domain/pilot/schemas.ts` (นอก repo ถ้ามี PII) |
| regression (commit)  | `demo/validation-dataset/`                                       |

---

## สำรองข้อมูล

- สำรอง `pilot-vault/` ไป encrypted storage ของโรงพยาบาลเป็นระยะ
- อย่า sync โฟลเดอร์นี้ไป cloud สาธารณะโดยไม่เข้ารหัส
