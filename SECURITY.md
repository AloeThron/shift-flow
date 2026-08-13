# Security Policy / นโยบายความปลอดภัย

## Supported Versions / เวอร์ชันที่รับรายงาน

| Version          | Supported   |
| ---------------- | ----------- |
| latest on `main` | yes         |
| older releases   | best effort |

โปรเจกตยังอยู่ในช่วง pre-release — รายงานช่องโหว่บน branch `main` จะได้รับการพิจารณาก่อน

## Reporting a Vulnerability / รายงานช่องโหว่

**อย่า** เปิด public GitHub issue สำหรับช่องโหว่ด้านความปลอดภัย

ส่งรายงานไปที่:

- **Email:** security@shift-flow.dev _(placeholder — อัปเดตเมื่อมี maintainer contact จริง)_
- **Subject:** `[SECURITY] Shift-Flow — สรุปสั้น`

รายงานควรมี:

1. คำอธิบายช่องโหว่และผลกระทบ (CVSS ถ้ามี)
2. ขั้นตอนทำซ้ำ (PoC ถ้าเป็นไปได้)
3. เวอร์ชัน/commit ที่ได้รับผลกระทบ
4. ข้อเสนอแนะการแก้ไข (ถ้ามี)

### สิ่งที่ถือเป็นช่องโหว่

- การเข้าถึงข้าม organization (tenant leakage)
- การ bypass authentication / authorization
- การเปิดเผยข้อมูลบุคลากรหรือ token โดยไม่ได้รับอนุญาต
- SQL injection, XSS, CSRF ที่ exploitable ได้จริง
- การ bypass hard safety constraints (overlap, competency expiry, unconfirmed codes)

### สิ่งที่ไม่ถือเป็นช่องโหว่

- การตั้งค่า policy ขององค์กรที่ admin ตั้งเอง (เช่น ปิด soft rule)
- การไม่มี public registration (invite-only เป็น design)
- Social engineering หรือ physical access
- ปัญหาใน dependency ที่มี patch แล้ว — รายงานผ่าน GitHub advisory ปกติได้

## Response Timeline / ระยะเวลาตอบกลับ

| ขั้นตอน                  | เป้าหมาย                       |
| ---------------------- | ----------------------------- |
| Acknowledgement        | ภายใน 3 วันทำการ                |
| Initial assessment     | ภายใน 7 วันทำการ                |
| Fix or mitigation plan | ภายใน 30 วัน (critical เร็วกว่า) |
| Coordinated disclosure | หลัง patch พร้อม deploy         |

## Safe Harbor

ผู้รายงานที่ปฏิบัติตามนโยบายนี้และไม่ทำลายข้อมูล/ไม่เข้าถึงข้อมูลเกินจำเป็น จะไม่ถูกดำเนินการทางกฎหมายจากทีม maintainer ในกรอบที่กฎหมายอนุญาต

## Security Practices / แนวปฏิบัติของโปรเจกต

- Auth.js Credentials + Argon2id; ไม่มี public signup
- Tenant boundary ผ่าน `organizationId` และ scoped repository
- Hard safety invariants ปิดไม่ได้ (overlap, competency expiry, unconfirmed codes)
- Secrets ไม่อยู่ใน repo; CI มี secret scan
- รายละเอียด threat model: [`docs/security/threat-model.md`](docs/security/threat-model.md)
- Backup/restore: [`docs/operations/backup-restore.md`](docs/operations/backup-restore.md)

## Related Documents

- [`docs/privacy/data-policy.md`](docs/privacy/data-policy.md)
- [`GOVERNANCE.md`](GOVERNANCE.md)
