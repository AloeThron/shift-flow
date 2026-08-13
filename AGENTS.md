# AGENTS.md — คู่มือสำหรับ agent ที่ทำงานใน Shift-Flow

> อัปเดตเมื่อ: 2026-08-13  
> บริบท: two-role + share link; canvas popup; starter pack Stage A/B; Biome; discovery เหลือ Q backlog + artifact inventory

---

## 1. สิ่งที่เก็บถาวร (อย่าลบ)

| เส้นทาง                                      | บทบาท                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `docs/domain/shift-code-taxonomy.md`        | พจนานุกรมรหัสเวร + WorkArea                                                   |
| `docs/domain/domain-model.md`               | ER + entity + ร่าง Prisma (ใน markdown เท่านั้น)                                |
| `docs/domain/optimization-model.md`         | สูตร min-cost flow, convex cost, carry-over, determinism                     |
| `docs/domain/scheduling-workflow.md`        | สองระยะ Stage A/B, สเปก canvas, workload                                    |
| `docs/domain/constraint-catalog.md`         | กติกา + หลักฐาน OCR (ยังไม่ sign-off)                                           |
| `docs/discovery/artifact-inventory.md`      | รายการ ART-ROST-PHOTO / ART-OT                                              |
| `docs/discovery/clarification-requests.md`  | backlog คำขอความชัดเจน Q1–Q21                                                 |
| `docs/privacy/data-policy.md`               | นโยบายข้อมูล + บัญชีข้อมูล (ไม่มีโมเดล Competency)                                  |
| `pilot-vault/anonymized/`                   | `staff_master.csv`, `roster_long.csv`, `id_map.csv` (gitignore)             |
| `pilot-vault/raw/ART-ROST-PHOTO-SET/`       | JPG + transcript ดิบ (gitignore, มี PII)                                      |
| `pilot-vault/manifest.json`                 | index ไฟล์ vault (gitignore)                                                 |
| `scripts/build_roster_artifacts.py`         | rebuild anonymized จาก transcript ใน vault                                  |
| `scripts/export_validation_fixtures.py`     | export `pilot-vault/anonymized/` → `demo/validation-dataset/` + golden JSON |
| `demo/starter-packs/`                       | ข้อมูลสังเคราะห์สำหรับ onboarding — ปรับต่อโรงพยาบาลได้                              |
| `demo/validation-dataset/`                  | ชุดนิรนาม commit ได้ — regenerate ด้วย `pnpm fixtures:export`                   |
| `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md` | OSS foundation — MIT, governance, รายงานช่องโหว่                              |

**ห้าม:** commit ชื่อจริงหรือรหัสพนักงานจริงลง `docs/` หรือ `demo/starter-packs/` — validation dataset ใน `demo/validation-dataset/` ต้องนิรนามแล้วเท่านั้น  
**หมายเหตุ:** `prisma/schema.prisma` มี auth + domain scheduling (รวม `ScheduleShareLink`, two-role enum)

---

## 2. ของชั่วคราว — ลบได้เมื่อไร

### ลบแล้ว (2026-08-10)

- `temp/crops_*` — ภาพตัดแถวสำหรับ re-OCR
- **`temp/` ทั้งโฟลเดอร์** — ย้าย JPG/csv/md → `pilot-vault/raw/ART-ROST-PHOTO-SET/` แล้ว; ข้อมูลนิรนาม export ไป `demo/validation-dataset/`

### นโยบาย

1. **อย่าเดาเซลล์ `?`** → คง `UNKNOWN` ใน validation dataset
2. ตัวชี้วัด baseline จริงอยู่ในการวัดหน้างาน / รายงาน JSON ของ go-live gate — **ห้าม** ใส่ค่าจำลองลง repo
3. โรงพยาบาลใหม่ใช้ **starter pack + admin config** — ไม่ต้องพึ่ง transcript OCR ของ pilot
4. re-OCR (ถ้าจำเป็น) แก้ transcript ใน `pilot-vault/raw/ART-ROST-PHOTO-SET/` แล้วรัน `build_roster_artifacts.py` + `pnpm fixtures:export`

---

## 3. สถานะข้อมูล validation (snapshot)

จาก `demo/validation-dataset/golden/status_summary.json` (นิรนาม, commit ได้):

| status   | จำนวนแถว (โดยประมาณ) |
| -------- | ------------------: |
| ASSIGNED |               ~2759 |
| OFF      |               ~1151 |
| UNKNOWN  |                ~526 |
| NO_SHIFT |                ~214 |
| LEAVE    |                  ~6 |

`UNKNOWN` ~11% ยอมรับได้สำหรับ regression — ไม่บล็อกการพัฒนา config-driven ต่อโรงพยาบาล

---

## 4. คำถามที่ยังค้าง

Backlog Q1–Q21 อยู่ที่ [`docs/discovery/clarification-requests.md`](docs/discovery/clarification-requests.md)

---

## 5. ลำดับงานถัดไปที่แนะนำ

1. ขยาย regression tests สำหรับ share link (create → view → revoke) และ canvas swap/override
2. implement `src/domain/optimize/` Stage B ให้ครบตาม [optimization-model.md](docs/domain/optimization-model.md) — แทน greedy solver ที่เหลือ
3. ~~rule templates Stage A/B ใน registry + starter pack~~ — `DAY_OFF_QUOTA`, `MAX_STAFF_OFF_PER_DAY`, `FAIR_DISTRIBUTION`, `OT_LIMIT` อยู่ใน `demo/starter-packs/pilot-lab-example/rule_instances.yaml` แล้ว
4. starter pack: regenerate `staff_groups.csv`, `scheduling_policy.yaml`, `otHours` — `pnpm fixtures:export`
5. นัดผู้จัดเวรตอบชุดสั้นใน clarification-requests (**Q1–Q4, Q8**)
6. ใช้ `demo/validation-dataset/` เป็น regression เมื่อแก้ validator/optimizer
7. รัน parallel pilot shadow ≥ 2 รอบ + `pnpm pilot:evaluate` รวม gate `ops.share-link-revoke`

---

## 6. ที่เก็บ agent tooling

| ที่เก็บ                                 | บทบาท                                                |
| ------------------------------------ | ---------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)             | กฎถาวรทั้งหมด — source of truth                        |
| [`.agents/skills/`](.agents/skills/) | workflow skills (OCR, rule template, discovery sync) |

### Agent skills

| Skill                                                                      | ใช้เมื่อ                                                          |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`roster-ocr-pipeline`](.agents/skills/roster-ocr-pipeline/SKILL.md)       | rebuild vault, export validation dataset (transcript ใน vault) |
| [`rule-template-workflow`](.agents/skills/rule-template-workflow/SKILL.md) | เพิ่ม/แก้ rule template, validator, sync registry                 |
| [`discovery-doc-sync`](.agents/skills/discovery-doc-sync/SKILL.md)         | ปิด Q*, sync คำตอบหน้างานเข้า domain docs                          |

---

## 7. กฎสั้นสำหรับ agent

- ตอบและเขียนเอกสารหลักเป็นภาษาไทยเมื่อเป็นงาน discovery/domain ของ repo นี้
- ฟังก์ชันโปรแกรมมิ่งแนว functional; ห้าม `any` ใน TypeScript
- comment สั้นเป็นภาษาไทยใน section/function ที่เขียนใหม่
- lint/format ด้วย [Biome](https://biomejs.dev/) — `pnpm lint` / `pnpm lint:fix` (ไม่ใช้ ESLint หรือ Prettier)
- ไม่ commit ของใน `pilot-vault/raw|anonymized|consent|manifest.json`
- ไม่สร้าง summary markdown นอกงานที่ถูกขอ
- ไม่ hardcode รหัสเวร/ชื่อแผนก/ชั่วโมงของแล็บนำร่องใน `src/` — ค่า org-specific อยู่ใน config/DB หรือ `demo/starter-packs/`
- rule template ใหม่ต้อง generic — เปิด issue ประเภท Rule Template Request ก่อน implement
- user-facing change บันทึกใน [`CHANGELOG.md`](CHANGELOG.md) ด้วยมือ
- รายงานช่องโหว่ตาม `SECURITY.md` ไม่เปิด public issue
