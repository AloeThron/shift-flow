# Governance / การกำกับดูแลโปรเจกต

> **License:** MIT · **Model:** benevolent maintainer + community contributions

---

## Mission / พันธกิจ

Shift-Flow เป็น open-source **policy engine สำหรับจัดตารางเวรห้องปฏิบัติการ** ที่แยก engine capability ออกจาก site policy — โรงพยาบาลแต่ละแห่งตั้งค่ารหัสเวร, coverage และกติกาผ่าน admin UI โดยไม่ต้อง fork โค้ด

---

## Roles / บทบาท

| บทบาท            | ความรับผิดชอบ                                                            |
| ---------------- | ------------------------------------------------------------------------ |
| **Maintainers**  | merge PR, release, security response, roadmap ระยะสั้น                   |
| **Contributors** | issue, PR, docs, tests, rule templates                                   |
| **Pilot sites**  | feedback หน้างาน, validation dataset (นิรนาม), ไม่ veto การ merge โดยตรง |

Maintainers เริ่มต้น: ทีมที่เปิด repo จนกว่าจะมีการโอนสิทธิ์อย่างเป็นทางการ

---

## Decision Making / การตัดสินใจ

### 1. การเปลี่ยน Engine Capability (โค้ด)

- Rule template ใหม่, validator, solver, auth, tenant boundary → **PR + review จาก maintainer**
- Template ใหม่ต้องเป็น **generic** — ห้าม hardcode ค่าเฉพาะแล็บเดียว
- Breaking change → RFC สั้นใน issue ก่อน implement; บันทึกใน CHANGELOG

### 2. การเปลี่ยน Site Policy (ข้อมูล)

- เป็นหน้าที่ **admin ของแต่ละ organization** ในระบบ
- Starter pack ใน `demo/starter-packs/` เป็น **ตัวอย่าง** — ไม่ใช่ค่า default บังคับของ engine

### 3. การเปลี่ยนเอกสาร Discovery

- `docs/domain/*`, `docs/discovery/*` — อัปเดตผ่าน PR; pilot data นิรนามอยู่นอก repo (`pilot-vault/` gitignore)

---

## Contribution Path / เส้นทางมีส่วนร่วม

1. อ่าน [`CONTRIBUTING.md`](CONTRIBUTING.md) และ [`AGENTS.md`](AGENTS.md)
2. เปิด issue อธิบายปัญหา/ฟีเจอร์ (ใช้ template)
3. Fork → branch → PR ไป `main` (หรือ `dev` ถ้า maintainer ระบุ)
4. CI ต้องผ่าน: lint, typecheck, tests, build _(เมื่อ scaffold พร้อม)_

### Rule Template Requests

ถ้าโรงพยาบาลต้องการกฎที่ไม่มีใน registry:

1. เปิด issue ประเภท **Rule Template Request**
2. แนบตัวอย่าง violation จากหน้างาน (นิรนาม)
3. Maintainer + reviewer ด้าน domain อนุมัติ generic schema
4. Implement ที่ `src/domain/rules/` — **ไม่** patch เฉพาะ org

---

## Releases / การปล่อยเวอร์ชัน

- **Semantic Versioning** (SemVer)
- Changelog ผ่าน [Changesets](https://github.com/changesets/changesets) — ดู [`.changeset/README.md`](.changeset/README.md)
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

Shift-Flow **ไม่ใช่**:

- ระบบบันทึกข้อมูลผู้ป่วย (ไม่เก็บผล LAB หรือ PHI)
- ที่ปรึกษากฎหมายแรงงาน — กติกาเป็นที่ HR/นิติกรของแต่ละหน่วยงานรับรอง
- การรับรอง ISO 15189 — รองรับ competency tracking แต่การ audit เป็นหน้าที่หน่วยงาน

---

## Contact

- General: GitHub Issues
- Security: ดู [`SECURITY.md`](SECURITY.md)
- Governance questions: เปิด issue label `governance`
