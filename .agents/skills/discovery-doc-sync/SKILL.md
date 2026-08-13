---
name: discovery-doc-sync
description: >-
  Syncs Shift-Flow discovery fieldwork into docs: update clarification-requests
  Q status and propagate answers to taxonomy and constraint-catalog. Use when
  closing Q items or syncing stakeholder answers into domain docs.
---

# Discovery Doc Sync

กฎถาวร → [`AGENTS.md`](../../../AGENTS.md) §4–6, [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) Documentation

## เมื่อใช้

- ปิดคำถาม Q* ใน clarification-requests
- sync คำตอบหน้างานเข้า domain docs

## Checklist

```
- [ ] 1. Q status — อัปเดต clarification-requests.md เท่านั้น
- [ ] 2. Propagate — กระจายคำตอบไป taxonomy / constraint-catalog
```

## ขั้นตอน 1: Clarification requests

อัปเดตสถานะและคำตอบที่ [`clarification-requests.md`](../../../docs/discovery/clarification-requests.md) **เท่านั้น**

- ตั้งสถานะ Q เป็น `ปิด` + วันที่ เมื่อได้คำตอบ
- **ห้าม** คัดลอกตารางยาว Q1–Q21 ไปเอกสารอื่น — link แทน
- ชุดที่แนะนำถามก่อน: **Q1–Q4, Q8** (ดู AGENTS.md §5)

## ขั้นตอน 2: Propagate คำตอบ

กระจายผลจาก Q ที่ปิดแล้วไปเอกสารที่เกี่ยวข้อง:

| หัวข้อ                      | ปลายทาง                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| ความหมายรหัสเวร / WorkArea | [`shift-code-taxonomy.md`](../../../docs/domain/shift-code-taxonomy.md) |
| กติกาจัดเวร                 | [`constraint-catalog.md`](../../../docs/domain/constraint-catalog.md)   |

เอกสาร discovery/domain → **ภาษาไทย** เป็นหลัก

## Gate: baseline

ตัวชี้วัด baseline จริงวัดที่หน้างานแล้วใส่รายงาน JSON ของ go-live gate (`src/domain/pilot/schemas.ts`) — **ห้าม** ใส่ค่าจำลองลง repo

## นโยบายข้อมูล

- **ห้าม** commit ชื่อจริงหรือรหัสพนักงานจริงลง `docs/` หรือ `demo/`
- **ห้าม** commit `pilot-vault/raw|anonymized|consent|manifest.json`
- ไม่สร้าง summary markdown นอกงานที่ถูกขอ

## อ้างอิง

- [`docs/discovery/README.md`](../../../docs/discovery/README.md)
- [`docs/discovery/clarification-requests.md`](../../../docs/discovery/clarification-requests.md)
- [`docs/discovery/artifact-inventory.md`](../../../docs/discovery/artifact-inventory.md)
- [`docs/privacy/data-policy.md`](../../../docs/privacy/data-policy.md)
