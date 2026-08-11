---
name: discovery-doc-sync
description: >-
  Syncs Shift-Flow discovery fieldwork into docs: update clarification-requests
  Q status, propagate answers to taxonomy and constraint-catalog, add INT session
  notes from templates, and update sessions index. Use when closing Q items,
  recording interviews, or syncing stakeholder answers into domain docs.
---

# Discovery Doc Sync

กฎถาวร → [`AGENTS.md`](../../../AGENTS.md) §4–6, [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) Documentation

## เมื่อใช้

- ปิดคำถาม Q* ใน clarification-requests
- บันทึกสัมภาษณ์/สังเกตการณ์ใหม่
- sync คำตอบหน้างานเข้า domain docs
- อัปเดต stakeholders หรือ constraint catalog

## Checklist

```
- [ ] 1. Q status — อัปเดต clarification-requests.md เท่านั้น
- [ ] 2. Propagate — กระจายคำตอบไป taxonomy / constraint-catalog / stakeholders
- [ ] 3. Session — สร้าง notes/INT-*.md จาก _templates/
- [ ] 4. Index — อัปเดต notes/sessions.md
- [ ] 5. Gate — ห้ามกรอก baseline.md ถ้ายังไม่พร้อม
```

## ขั้นตอน 1: Clarification requests

อัปเดตสถานะและคำตอบที่ [`clarification-requests.md`](../../../docs/discovery/clarification-requests.md) **เท่านั้น**

- ตั้งสถานะ Q เป็น `ปิด` + วันที่ เมื่อได้คำตอบ
- **ห้าม** คัดลอกตารางยาว Q1–Q21 ไปเอกสารอื่น — link แทน
- ชุดที่แนะนำถามก่อน: **Q1–Q4, Q8** (ดู AGENTS.md §5)

## ขั้นตอน 2: Propagate คำตอบ

กระจายผลจาก Q ที่ปิดแล้วไปเอกสารที่เกี่ยวข้อง:

| หัวข้อ                     | ปลายทาง                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| ความหมายรหัสเวร / WorkArea | [`shift-code-taxonomy.md`](../../../docs/domain/shift-code-taxonomy.md) |
| กติกาจัดเวร                | [`constraint-catalog.md`](../../../docs/domain/constraint-catalog.md)   |
| ผู้มีส่วนได้ส่วนเสีย       | [`stakeholders.md`](../../../docs/discovery/stakeholders.md)            |

เอกสาร discovery/domain → **ภาษาไทย** เป็นหลัก

## ขั้นตอน 3–4: Session notes

1. คัดลอกแม่แบบจาก [`docs/discovery/notes/_templates/`](../../../docs/discovery/notes/_templates/) → `notes/INT-*.md`
2. บันทึก consent → `pilot-vault/consent/` (ไม่ commit)
3. อัปเดต [`notes/sessions.md`](../../../docs/discovery/notes/sessions.md)

ดู workflow ใน [`docs/discovery/README.md`](../../../docs/discovery/README.md)

## Gate: baseline

**ห้าม** กรอก [`docs/pilot/baseline.md`](../../../docs/pilot/baseline.md) จนกว่า:

- UNKNOWN ใน roster ลดลงพอใช้วัด violation
- นิยามชม./night ตรงกันระหว่าง taxonomy กับหน้างาน

## นโยบายข้อมูล

- **ห้าม** commit ชื่อจริงหรือรหัสพนักงานจริงลง `docs/` หรือ `demo/`
- **ห้าม** commit `pilot-vault/raw|anonymized|consent|manifest.json`
- ไม่สร้าง summary markdown นอกงานที่ถูกขอ

## อ้างอิง

- [`docs/discovery/README.md`](../../../docs/discovery/README.md)
- [`docs/discovery/clarification-requests.md`](../../../docs/discovery/clarification-requests.md)
- [`docs/discovery/artifact-inventory.md`](../../../docs/discovery/artifact-inventory.md)
