# Contributing to Shift-Flow

ขอบคุณที่สนใจมีส่วนร่วม — เอกสารนี้อธิบาย workflow สำหรับ contributor ทั้ง code และ docs

---

## Before You Start / ก่อนเริ่ม

1. อ่าน [`README.md`](README.md) และ [`GOVERNANCE.md`](GOVERNANCE.md)
2. สำหรับ agent/AI: อ่าน [`AGENTS.md`](AGENTS.md)
3. Domain & config model: [`docs/domain/configuration-model.md`](docs/domain/configuration-model.md)
4. **ห้าม** commit ข้อมูลจริง (ชื่อพนักงาน, รหัสจริง) — ใช้ [`demo/`](demo/) สำหรับข้อมูลสังเคราะห์

---

## Ways to Contribute / วิธีมีส่วนร่วม

| ประเภท        | ตัวอย่าง                                           |
| ------------- | ------------------------------------------------ |
| Bug fix       | validator จับ overlap ผิด, UI แสดงวันที่ผิด            |
| Feature       | admin UI สำหรับ coverage, export ICS               |
| Rule template | เพิ่ม template generic ใหม่ใน registry              |
| Docs          | แปล/ปรับปรุง docs/domain, starter pack             |
| Tests         | golden fixtures, property tests, tenant boundary |
| Starter pack  | ชุด config สังเคราะห์สำหรับประเภทแล็บอื่น                |

---

## Development Setup / การตั้งค่า

```bash
git clone https://github.com/AloeThron/shift-flow.git
cd shift-flow
pnpm install
cp .env.example .env.local
docker compose up -d   # PostgreSQL local
pnpm db:migrate
pnpm dev
```

รายละเอียดเพิ่มเติม: [`README.md`](README.md)

---

## Branch & Commit / Git workflow

- Branch จาก `main` (หรือ `dev` ตามที่ maintainer ระบุ)
- Commit message สั้น เน้นเหตุผล

---

## Pull Request Checklist

- [ ] Tests เพิ่ม/อัปเดต (ถ้าแก้ logic)
- [ ] อัปเดต [`CHANGELOG.md`](CHANGELOG.md) ถ้าเป็น user-facing change
- [ ] ไม่มี secret, PII, หรือไฟล์ `pilot-vault/` ที่ gitignore

Job `e2e` ใน CI ข้ามเมื่อไฟล์ที่เปลี่ยนอยู่ใน `docs/`, `CHANGELOG.md`, markdown ราก, `.agents/` หรือ `.github/ISSUE_TEMPLATE/`

---

## Code Style

| หัวข้อ        | กฎ                                                                                   |
| ----------- | ------------------------------------------------------------------------------------ |
| TypeScript  | strict; ห้าม `any`                                                                    |
| Lint/Format | [Biome](https://biomejs.dev/) — `pnpm lint` (`biome check .`); แก้ด้วย `pnpm lint:fix` |
| Style       | functional; pure domain ไม่มี I/O                                                      |
| Comments    | ภาษาไทยสั้น ๆ ใน section/function ที่เพิ่มใหม่                                              |
| Domain      | config-driven — ค่า org-specific อยู่ใน DB/demo CSV ไม่ใช่ enum ในโค้ด                     |
| Tests       | Vitest + fast-check สำหรับ constraints; integration ใช้ PostgreSQL จริง                  |

---

## Adding a Rule Template

1. เปิด issue **Rule Template Request** พร้อมตัวอย่างนิรนาม
2. เพิ่ม definition ใน [`docs/domain/rule-templates.md`](docs/domain/rule-templates.md)
3. Implement validator ที่ `src/domain/rules/`
4. Unit tests + configurability test (org สองแห่ง กติกาต่างกัน ทำงานถูก)
5. ไม่เพิ่มพารามิเตอร์ที่ผูกกับรหัสเวรเฉพาะแล็บเดียว

---

## Documentation

- Discovery/domain docs: **ภาษาไทย** เป็นหลัก — ดู [`docs/discovery/README.md`](docs/discovery/README.md)
- README, CONTRIBUTING, SECURITY: **ไทย + อังกฤษ**
- นโยบายข้อมูล: [`docs/privacy/data-policy.md`](docs/privacy/data-policy.md)
- อย่าสร้าง summary markdown นอกงานที่ถูกขอ
- อย่าคัดลอกตารางยาวจาก `clarification-requests.md` ไปที่อื่น — link แทน

---

## Starter Packs & Demo Data

- อยู่ที่ [`demo/starter-packs/`](demo/starter-packs/)
- ชื่อบุคลากรและรหัสต้อง **สังเคราะห์** — ไม่ map กับ pilot-vault
- ระบุใน README ของ pack ว่าเป็นตัวอย่าง ต้องปรับก่อนใช้จริง
- Schema คolumn: ดู [`demo/README.md`](demo/README.md)

---

## Review Process

1. Maintainer review code + tests
2. Domain-sensitive PR อาจขอ review จากผู้มีประสบการณ์จัดเวรแล็บ (optional reviewer)
3. Security-sensitive PR ต้องผ่าน checklist ใน [`SECURITY.md`](SECURITY.md)
4. Merge squash หรือ merge commit ตามนโยบาย repo

---

## License

การ contribute ถือว่ายินยอมให้ code ของ contributor อยู่ภายใต้ [MIT License](LICENSE)
