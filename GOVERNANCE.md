# Governance / การกำกับดูแลโปรเจกต

> **License:** MIT · **Model:** benevolent maintainer + community contributions

---

## Mission / พันธกิจ

พันธกิจ ขอบเขต และข้อจำกัดความรับผิดชอบอยู่ที่ [`README.md`](README.md) — engine แยกจาก site policy ของแต่ละองค์กร

---

## Roles / บทบาท

| บทบาท            | ความรับผิดชอบ                                                           |
| ---------------- | --------------------------------------------------------------------- |
| **Maintainers**  | merge PR, release, security response, roadmap ระยะสั้น                  |
| **Contributors** | issue, PR, docs, tests, rule templates                                |
| **Pilot sites**  | feedback หน้างาน, validation dataset (นิรนาม), ไม่ veto การ merge โดยตรง |

Maintainers เริ่มต้น: ทีมที่เปิด repo จนกว่าจะมีการโอนสิทธิ์อย่างเป็นทางการ

---

## Decision Making / การตัดสินใจ

### 1. การเปลี่ยน Engine Capability (โค้ด)

- Rule template ใหม่, validator, solver, auth, tenant boundary → **PR + review จาก maintainer**
- Template ใหม่ต้องเป็น **generic** — ห้าม hardcode ค่าเฉพาะแล็บเดียว
- Breaking change → RFC สั้นใน issue ก่อน implement; บันทึกใน [`CHANGELOG.md`](CHANGELOG.md)

### 2. การเปลี่ยน Site Policy (ข้อมูล)

- เป็นหน้าที่ **admin ของแต่ละ organization** ในระบบ
- Starter pack ใน `demo/starter-packs/` เป็น **ตัวอย่าง** — ไม่ใช่ค่า default บังคับของ engine

### 3. การเปลี่ยนเอกสาร Discovery

- `docs/domain/*`, [`docs/discovery/clarification-requests.md`](docs/discovery/clarification-requests.md), [`docs/discovery/artifact-inventory.md`](docs/discovery/artifact-inventory.md) — อัปเดตผ่าน PR
- ข้อมูลนำร่องนิรนามอยู่นอก repo (`pilot-vault/` gitignore)

---

## Contribution Path / เส้นทางมีส่วนร่วม

1. อ่าน [`CONTRIBUTING.md`](CONTRIBUTING.md) และ [`AGENTS.md`](AGENTS.md)
2. Fork → branch → PR ไป `main` (หรือ `dev` ถ้า maintainer ระบุ)
3. เปิด issue เมื่อต้องการหารือ หรือเมื่อขอ rule template ใหม่ — ไม่บังคับทุก PR
4. CI ต้องผ่าน: lint (Biome), typecheck, tests (build อยู่ใน job `e2e` เมื่อมีไฟล์แอปเปลี่ยน)

### Rule Template Requests

ถ้าโรงพยาบาลต้องการกฎที่ไม่มีใน registry:

1. เปิด issue ประเภท **Rule Template Request**
2. แนบตัวอย่าง violation จากหน้างาน (นิรนาม)
3. Maintainer + reviewer ด้าน domain อนุมัติ generic schema
4. Implement ที่ `src/domain/rules/` — **ไม่** patch เฉพาะ org

---

## Releases / การปล่อยเวอร์ชัน

- **Semantic Versioning** (SemVer)
- บันทึกการเปลี่ยนแปลงใน [`CHANGELOG.md`](CHANGELOG.md) ด้วยมือ (Keep a Changelog)
- Pre-1.0: API อาจเปลี่ยนได้; pilot phase ไม่ guarantee backward compatibility

---

## Code of Conduct

พฤติกรรมในชุมชนผูกพันตาม [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

---

## Security

รายงานช่องโหว่ตาม [`SECURITY.md`](SECURITY.md) — ไม่เปิด public issue

---

## Intellectual Property

- โค้ดใน repo: MIT License — ดู [`LICENSE`](LICENSE)
- ข้อมูลนำร่องจากหน้างานจริง: **ไม่** commit ลง repo; ใช้ synthetic demo ใน `demo/` แทน
- ชื่อ Shift-Flow ใช้ระบุโปรเจกต; ไม่ imply endorsement จากโรงพยาบาลใด

---

## Disclaimers / ข้อจำกัดความรับผิดชอบ

ดูตารางใน [`README.md`](README.md) — สรุปสั้น: ไม่ใช่ระบบผู้ป่วย, ไม่ใช่ที่ปรึกษากฎหมายแรงงาน, ไม่รับรอง ISO แทนหน่วยงาน

---

## Contact

- General: GitHub Issues
- Security: ดู [`SECURITY.md`](SECURITY.md)
- Governance questions: เปิด issue label `governance`
