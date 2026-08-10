# Interview Guide — คุณภาพ, HR/นิติกร, IT/DPO

> ระยะเวลา: 45–60 นาทีต่อฝ่าย (แนะนำแยก session)  
> เป้าหมาย: รับรอง constraint catalog, data inventory และ policy boundary

---

## Session A — HR / เงินเดือน / นิติกร

### 0. Pre-session

- [ ] Consent ได้รับแล้ว
- [ ] รหัส: `INT-HR-___`
- [ ] วันที่: ___________

### A1. สัญญาจ้างและ FTE

| คำถาม                                  | บันทึก |
| ------------------------------------- | ---- |
| ประเภทสัญญาที่มี (ข้าราชการ/ลูกจ้าง/จ้างเหมา) |      |
| FTE กำหนดชั่วโมงเป้าหมายอย่างไร            |      |
| part-time / per diem มีหรือไม่           |      |
| สัญญามี effective date ย้อนหลังได้หรือไม่    |      |

### A2. เวลางาน, OT และวันหยุด

| คำศัพท์                | นิยามที่ HR ใช้ | แหล่งนโยบาย |
| ------------------- | ----------- | ---------- |
| ชั่วโมงงานปกติ         |             |            |
| OT                  |             |            |
| วันหยุดนักขัตฤกษ์        |             |            |
| วันหยุดสลับ/substitute |             |            |
| ค่าเวรดึก/วันหยุด       |             |            |

**คำถามสำคัญ:**
- กติกาใดเป็น **hard** ที่ HR ไม่ยอมให้ override?
- กติกาใด override ได้โดย Lab Head หรือต้อง HR sign-off?
- ระบบ **ไม่** ให้คำปร Consult กฎหมาย — HR รับรอง policy ใน catalog เอง?

### A3. Leave policy

| หัวข้อ                | รายละเอียด                              |
| ------------------- | -------------------------------------- |
| ประเภทลาที่ใช้ในแล็บ    |                                        |
| ระดับข้อมูลเหตุผลที่อนุญาต | หมวด operational / ไม่เก็บรายละเอียดสุขภาพ |
| retention ใบลา      |                                        |
| ใครดู leave reason   |                                        |

### A4. Payroll export (phase หลัง)

- ฟิลด์ที่ payroll ต้องการใน export?
- reconciliation ทำอย่างไร?
- planned vs actual แยกเมื่อไร?

---

## Session B — ผู้รับผิดชอบคุณภาพ / ISO 15189

### 0. Pre-session

- [ ] Consent ได้รับแล้ว
- [ ] รหัส: `INT-QA-___`
- [ ] วันที่: ___________

### B1. Competency model

| คำถาม                                          | บันทึก |
| --------------------------------------------- | ---- |
| competency แยกตาม activity, instrument หรือทั้งคู่ |      |
| มีระดับ (level) กี่ขั้น                             |      |
| ใครเป็น approver ของ authorization             |      |
| ความถี่ re-assessment                           |      |
| หมดอายุแล้วทำอย่างไร (ห้ามขึ้นเวร / supervision)     |      |

### B2. Supervision และ lone working

- งานใดต้องมี lead/supervisor ตลอดเวร?
- bench ใดห้าม lone working?
- handover บังคับหรือไม่ ระยะเวลา?

### B3. Audit และ documentation

- audit trail ต้องมีฟิลด์อะไร (actor, before/after, reason)?
- retention บันทึก authorization?
- รายงาน safety ที่ต้องการก่อน publish?

### B4. Hard constraints จากคุณภาพ

| Rule ID (draft) | คำอธิบาย                                         | Override |
| --------------- | ---------------------------------------------- | -------- |
| QA-001          | assignment ต้องมี valid authorization ตลอดช่วงเวร | NEVER    |
| QA-002          |                                                |          |
| QA-003          |                                                |          |

---

## Session C — IT Security / DPO

### 0. Pre-session

- [ ] Consent ได้รับแล้ว
- [ ] รหัส: `INT-IT-___`
- [ ] วันที่: ___________

### C1. PDPA และ data classification

| ข้อมูล                   | ระดับความอ่อนไหว | เก็บใน Shift-Flow? | หมายเหตุ |
| ---------------------- | -------------- | ----------------- | ------- |
| ชื่อ-นามสกุลพนักงาน        |                | ใช่ (จำกัดสิทธิ์)       |         |
| เลขบัตร/บัญชีธนาคาร       |                | ไม่                |         |
| รายละเอียดอาการ/ใบลาป่วย |                | **ไม่**            |         |
| ตารางเวร               |                | ใช่                |         |
| competency record      |                | ใช่                |         |
| IP / access log        |                | ใช่                |         |

### C2. Access control

- role ใดเข้าถึงข้อมูลใด (ยืนยัน RBAC draft)?
- ต้องการ MFA หรือไม่ (phase แรก/หลัง)?
- session timeout ที่ยอมรับได้?

### C3. Retention และ deletion

| ข้อมูล            | retention | วิธีลบ/ anonymize |
| --------------- | --------- | --------------- |
| ตาราง published |           |                 |
| audit log       |           |                 |
| leave request   |           |                 |
| account ที่ลาออก  |           |                 |

### C4. Security requirements

- hosting: Vercel + Neon ยอมรับได้หรือต้อง on-prem?
- backup RPO/RTO ที่ต้องการ?
- incident notification ภายในกี่ชั่วโมง?
- logging: ห้าม log อะไรบ้าง (password, token, PII)?

---

## Cross-session — Sign-off Checklist

ใช้ตอนปิด Discovery Gate:

| เอกสาร                | HR/Legal | Quality | DPO/IT | Lab Head | Scheduler |
| --------------------- | :------: | :-----: | :----: | :------: | :-------: |
| constraint-catalog.md |    ☐     |    ☐    |   ☐    |    ☐     |     ☐     |
| data-inventory.md     |    ☐     |    ☐    |   ☐    |    ☐     |     ☐     |
| นิยามคำศัพท์เวลางาน       |    ☐     |    ☐    |   ☐    |    ☐     |     ☐     |
| leave category list   |    ☐     |    ☐    |   ☐    |    ☐     |     ☐     |

---

## Debrief Template (รวมทุก session)

```markdown
### สรุป HR / QA / IT

**Policy rules ที่เป็น NEVER override:**
-

**Policy rules ที่ APPROVER_REQUIRED:**
-

**Competency fields ที่บังคับ:**
-

**ข้อมูลที่ห้ามเก็บ (ยืนยัน):**
-

**Retention ที่ตกลง:**
-

**Open risks:**
-

**Action items ก่อน scaffold code:**
1.
2.
```
