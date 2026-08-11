# Discovery Notes — บันทึกราย session

> เก็บสรุปสัมภาษณ์และ observation **แบบนิรนาม** — commit ได้  
> ชื่อจริง / consent ดิบ → `pilot-vault/consent/`

---

## การตั้งชื่อไฟล์

| รหัส prefix | ใช้กับ            | ตัวอย่าง         |
| ----------- | ----------------- | ---------------- |
| `INT-SCH-`  | ผู้จัดเวร         | `INT-SCH-001.md` |
| `INT-STF-`  | เจ้าหน้าที่       | `INT-STF-001.md` |
| `INT-HR-`   | HR / นิติกร       | `INT-HR-001.md`  |
| `INT-QA-`   | คุณภาพ / ISO      | `INT-QA-001.md`  |
| `INT-IT-`   | DPO / IT          | `INT-IT-001.md`  |
| `OBS-SCH-`  | สังเกตการณ์จัดเวร | `OBS-SCH-001.md` |

เลขลำดับ 3 หลัก (`001`, `002`, …) ต่อ prefix

---

## วิธีสร้าง note ใหม่

1. คัดลอกแม่แบบจาก `_templates/` ที่ตรงประเภท
2. ตั้งชื่อตามตารางด้านบน
3. กรอกหลัง session — **ห้าม** ใส่ชื่อจริง
4. สรุปที่สำคัญ sync ไปเอกสารหลัก (ดูตารางด้านล่าง)
5. อัปเดต [sessions.md](./sessions.md)

---

## Sync ไปเอกสารหลัก

| เนื้อหาใน note             | อัปเดตที่                                                                       |
| -------------------------- | ------------------------------------------------------------------------------- |
| pain points, RACI          | [stakeholders.md](../stakeholders.md)                                           |
| hard/soft rules, คำนิยาม   | [constraint-catalog.md](../../domain/constraint-catalog.md)                     |
| ฟิลด์ข้อมูล, retention     | [data-inventory.md](../../privacy/data-inventory.md)                            |
| เวลา, revision, violations | [baseline.md](../../pilot/baseline.md)                                          |
| artifact ที่ได้รับ         | [artifact-inventory.md](../artifact-inventory.md) + `pilot-vault/manifest.json` |

---

## แม่แบบ

| ไฟล์                                                     | ใช้เมื่อ            |
| -------------------------------------------------------- | ------------------- |
| [_templates/scheduler.md](./_templates/scheduler.md)     | สัมภาษณ์ผู้จัดเวร   |
| [_templates/staff.md](./_templates/staff.md)             | สัมภาษณ์เจ้าหน้าที่ |
| [_templates/hr.md](./_templates/hr.md)                   | HR / นิติกร         |
| [_templates/qa.md](./_templates/qa.md)                   | คุณภาพ / ISO        |
| [_templates/it.md](./_templates/it.md)                   | DPO / IT            |
| [_templates/observation.md](./_templates/observation.md) | สังเกตการณ์จัดเวร   |

---

## Index

ดูรายการ session ทั้งหมดที่ [sessions.md](./sessions.md)
