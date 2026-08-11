# Data Policy — Shift-Flow

> อัปเดต: 2026-08-10  
> อ้างอิง: [`data-inventory.md`](data-inventory.md), พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562

---

## 1. หลักการ

1. **Data minimization** — เก็บเฉพาะที่จำเป็นต่อการจัดเวร
2. **Purpose limitation** — ใช้ข้อมูลเพื่อ scheduling/workforce เท่านั้น
3. **Org isolation** — ข้อมูลแยกตาม organization
4. **No PHI** — ไม่เก็บข้อมูลผู้ป่วยหรือผลตรวจ

---

## 2. ข้อมูลที่เก็บ

| หมวด        | ตัวอย่าง                        | ฐานทางกฎหมาย (ให้ org ยืนยัน) |
| ----------- | ----------------------------- | -------------------------- |
| บัญชีผู้ใช้      | username, display name, email | สัญญ/joint interest         |
| ข้อมูลเวร     | assignment, swap              | การจ้างงาน                  |
| ความพร้อม/ลา | วันลา (หมวด operational)       | การจ้างงาน                  |
| Competency  | ระดับ, วันหมดอายุ                | ISO 15189 / คุณภาพ          |
| Audit       | ใครทำอะไร เมื่อไหร่               | legitimate interest        |

---

## 3. ข้อมูลที่ไม่เก็บ

- อาการ/การวินิจฉัย/ใบรับรองแพทย์
- ผลแล็บผู้ป่วย
- รูปเอกสารสุขภาพ
- หมายเลขบัตรประชาชน (ยกเว้น org กำหนดเองนอก scope รุ่นแรก)

---

## 4. สิทธิ์การเข้าถึง

| Role           | ข้อมูลที่เข้าถึงได้                 |
| -------------- | ---------------------------- |
| STAFF          | roster ของตน + ทีมตาม policy  |
| SCHEDULER      | บุคลากร + ตาราง draft/publish |
| APPROVER       | publish, override ที่อนุญาต     |
| AUDITOR        | audit read-only              |
| PAYROLL_VIEWER | export ชั่วโมง (phase ถัดไป)    |

รายละเอียด: [`../security/rbac.md`](../security/rbac.md)

---

## 5. Retention (แนะนำ — org ปรับได้)

| ข้อมูล                     | ระยะเก็บแนะนำ        |
| ------------------------ | ------------------ |
| Published roster + audit | ≥ 3 ปี (HR/quality) |
| Draft ที่ไม่ publish        | 90 วัน              |
| Auth logs (redacted)     | 90 วัน              |
| Session                  | 8 ชม. max          |

---

## 6. สิทธิของเจ้าของข้อมูล

องค์กร (data controller) รับผิดชอบ:

- แจ้งวัตถุประสงค์ให้พนักงาน
- Export / correction / delete ตามคำขอ
- แจ้ง breach ต่อ สคส. ภายใน 72 ชม. เมื่อเข้าเกณฑ์

ระบบรองรับ:

- Export roster CSV
- Deactivate account (`UserStatus.DISABLED`)
- Audit trail สำหรับ correction

---

## 7. การ log และ metrics

- Logs **redact** password, token, email, username
- Metrics **ไม่มี** PII ใน labels
- Correlation ID ใช้ trace ไม่ใช่ identify โดยตรง

Implementation: `src/lib/observability/redact.ts`

---

## 8. การโอนข้อมูล / sub-processor

| Sub-processor | วัตถุประสงค์          | ที่ตั้ง              |
| ------------- | ------------------ | ---------------- |
| Neon          | PostgreSQL hosting | ตาม region ที่เลือก |
| Vercel        | App hosting        | Global CDN       |

Org ต้องทำ DPA กับ sub-processor เอง

---

## 9. Pilot data

- ข้อมูลจริงจากหน้างานอยู่ `pilot-vault/` (gitignore)
- Repo ใช้ synthetic demo เท่านั้น
- ห้าม commit PII ลง `docs/` หรือ `demo/`
