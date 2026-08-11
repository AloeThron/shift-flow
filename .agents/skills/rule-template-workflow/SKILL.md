---
name: rule-template-workflow
description: >-
  Adds or updates Shift-Flow rule templates: issue, docs, registry sync with
  validatorKey and constraintCatalogRef, pure validators in src/domain/rules/validators/,
  and Vitest plus fast-check tests. Use for Rule Template Request issues, new
  constraint validators, registry.ts changes, or constraint-catalog updates.
---

# Rule Template Workflow

กฎถาวร (generic template, ห้าม any, ไม่ hardcode org) → [`AGENTS.md`](../../../AGENTS.md) §6, [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)

## เมื่อใช้

- เปิด/ทำ Rule Template Request
- เพิ่มหรือแก้ validator ใน `src/domain/rules/`
- sync drift ระหว่าง docs กับ [`registry.ts`](../../../src/domain/rules/registry.ts)
- อัปเดต [`constraint-catalog.md`](../../../docs/domain/constraint-catalog.md)

## Checklist

```
- [ ] 1. Issue — Rule Template Request พร้อมตัวอย่าง violation นิรนาม
- [ ] 2. Docs — rule-templates.md + constraint-catalog HC-/SC-
- [ ] 3. Registry — sync registry.ts (รวม validatorKey, constraintCatalogRef)
- [ ] 4. Validator — pure function ใน src/domain/rules/validators/
- [ ] 5. Tests — Vitest + fast-check + configurability (2 orgs)
- [ ] 6. Verify — safetyLocked, engine invariants ไม่เป็น template ปิดได้
```

## ขั้นตอน 1–2: Issue + docs

1. เปิด issue **Rule Template Request** ก่อน implement
2. เพิ่ม/แก้ definition ใน [`rule-templates.md`](../../../docs/domain/rule-templates.md) §1 — ครบทุกฟิลด์ รวม `validatorKey`, `constraintCatalogRef`
3. อ้าง HC-/SC- ใน [`constraint-catalog.md`](../../../docs/domain/constraint-catalog.md)
4. **ไม่** แก้เฉพาะกิจ org เดียว — template ต้อง generic

## ขั้นตอน 3: Registry sync

แก้ [`src/domain/rules/registry.ts`](../../../src/domain/rules/registry.ts) ให้ตรง spec:

| ฟิลด์                  | หมายเหตุ                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `id`                   | SCREAMING_SNAKE — ไม่ rename หลัง release                     |
| `paramSchema`          | Zod schema                                                    |
| `safetyLocked`         | `true` → บังคับ HARD + NEVER                                  |
| `constraintCatalogRef` | อ้าง HC-/SC- — **ยังขาดใน registry ปัจจุบัน**                 |
| `validatorKey`         | ชื่อฟังก์ชันใน `validators/` — **ยังขาดใน registry ปัจจุบัน** |

Registry ปัจจุบันมี 8 templates: `MIN_REST_BETWEEN_SHIFTS`, `MAX_HOURS_IN_WINDOW`, `MAX_CONSECUTIVE_NIGHTS`, `FORBIDDEN_CODE_SEQUENCE`, `REQUIRED_COVERAGE`, `REQUIRED_COMPETENCY_IN_SHIFT`, `GRADE_CODE_WHITELIST`, `PREFERRED_PATTERN`

## ขั้นตอน 4: Validator

สร้างที่ `src/domain/rules/validators/`:

- pure function — **ไม่มี I/O**
- functional style; **ห้าม `any`**
- comment สั้นภาษาไทยใน section/function ใหม่
- ไม่ hardcode รหัสเวร/ชื่อแผนก/ชม. ของแล็บนำร่อง

## ขั้นตอน 5: Tests

```bash
pnpm test
pnpm check   # format + lint + typecheck + test + build
```

- unit test ต่อ validator
- fast-check สำหรับ property ที่เหมาะ
- **configurability test**: org สองแห่ง กติกาต่างกัน ทำงานถูก

ปัจจุบัน `tests/unit/` มี `tenant-domain`, `env` — เพิ่ม tests สำหรับ rules ที่ implement

## Engine invariants (ไม่ใช่ template)

implement ใน engine โดยตรง — **ไม่ปรากฏใน admin UI เป็น template ที่ปิดได้**:

| Key                        | Catalog |
| -------------------------- | ------- |
| `NO_TIME_OVERLAP`          | HC-001  |
| `APPROVED_LEAVE_BLOCK`     | HC-002  |
| `UNCONFIRMED_CODE_BLOCKED` | —       |
| `MIDNIGHT_INTEGRITY`       | HC-009  |

## อ้างอิง

- [`docs/domain/rule-templates.md`](../../../docs/domain/rule-templates.md)
- [`docs/domain/configuration-model.md`](../../../docs/domain/configuration-model.md)
- [`docs/domain/constraint-catalog.md`](../../../docs/domain/constraint-catalog.md)
- [`src/domain/rules/registry.ts`](../../../src/domain/rules/registry.ts)
