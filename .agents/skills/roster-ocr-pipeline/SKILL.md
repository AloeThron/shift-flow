---
name: roster-ocr-pipeline
description: >-
  Rebuilds anonymized pilot-vault from raw transcripts, exports validation
  dataset and golden fixtures. Use when updating transcripts in
  pilot-vault/raw/ART-ROST-PHOTO-SET/, running build_roster_artifacts.py,
  or regenerating demo/validation-dataset/.
---

# Roster OCR Pipeline

กฎถาวร (PII, ไม่เดา `?`, ไม่ commit vault) → อ่าน [`AGENTS.md`](../../../AGENTS.md)

> **`temp/` ปิดแล้ว (2026-08-10)** — transcript อยู่ `pilot-vault/raw/ART-ROST-PHOTO-SET/`  
> ข้อมูล commit ได้: `demo/validation-dataset/` — โรงพยาบาลใหม่ใช้ starter pack แทน

## เมื่อใช้

- แก้ transcript csv/md ใน vault (re-OCR หรือแก้เซลล์ที่อ่านได้)
- รัน `scripts/build_roster_artifacts.py` → rebuild anonymized
- รัน `pnpm fixtures:export` → อัปเดต validation dataset + golden

## Checklist

```
- [ ] 1. Transcript — แก้ csv/md ใน pilot-vault/raw/ART-ROST-PHOTO-SET/ (ถ้าจำเป็น)
- [ ] 2. Patch script — แก้ dict ใน build_roster_artifacts.py ถ้าแถวถูก hardcode
- [ ] 3. Build — python scripts/build_roster_artifacts.py
- [ ] 4. Verify — นับ status ใน pilot-vault/anonymized/roster_long.csv
- [ ] 5. Export — pnpm fixtures:export
- [ ] 6. Inventory — อัปเดต artifact-inventory.md ถ้าจำเป็น
```

## ขั้นตอน 1–2: Transcript + patch

1. อ่าน JPG ใน `pilot-vault/raw/ART-ROST-PHOTO-SET/` คู่กับ csv/md
2. เขียนกลับเฉพาะเซลล์ที่อ่านได้ — **อย่าเดา** `?`
3. กฎ parsing: `MI` ≠ `IM`; `[แดง]` เป็น marker — ดู [`shift-code-taxonomy.md`](../../../docs/domain/shift-code-taxonomy.md)

**Hardcode patch ใน script** — แก้ csv อย่างเดียวจะถูกทับ:

| dict            | ไฟล์                |
| --------------- | ------------------- |
| `MARCH_ROWS`    | `S__21069856_0.csv` |
| `MAY_ROW2_TAIL` | `S__21069853_0.csv` |
| `AUG_ROWS`      | `S__21069860.csv`   |

## ขั้นตอน 3–4: Build + verify

```bash
python scripts/build_roster_artifacts.py
```

```bash
python -c "
import csv
from collections import Counter
from pathlib import Path
p = Path('pilot-vault/anonymized/roster_long.csv')
rows = list(csv.DictReader(p.open(encoding='utf-8')))
print(Counter(r['status'] for r in rows))
"
```

## ขั้นตอน 5: Export validation dataset

```bash
pnpm fixtures:export
```

Regression: `tests/unit/pilot-validation-fixtures.test.ts`

## อ้างอิง

- [`scripts/build_roster_artifacts.py`](../../../scripts/build_roster_artifacts.py)
- [`scripts/export_validation_fixtures.py`](../../../scripts/export_validation_fixtures.py)
- [`demo/validation-dataset/README.md`](../../../demo/validation-dataset/README.md)
- [`pilot-vault/README.md`](../../../pilot-vault/README.md)
