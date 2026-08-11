# Incident Response — Shift-Flow

> อัปเดต: 2026-08-10  
> ใช้ร่วมกับ [`backup-restore.md`](backup-restore.md) และ [`../security/threat-model.md`](../security/threat-model.md)

---

## 1. ระดับความรุนแรง

| Severity  | ตัวอย่าง                                                                   | เป้า initial response |
| --------- | ------------------------------------------------------------------------ | -------------------- |
| **SEV-1** | Tenant leakage, hard safety violation ใน published roster, DB ไม่ recover | 15 นาที               |
| **SEV-2** | Auth bypass, ระบบล่มทั้ง org, restore จำเป็น                                  | 30 นาที               |
| **SEV-3** | Solver fail ซ้ำ, workflow ค้าง, metrics anomaly                             | 4 ชั่วโมง              |
| **SEV-4** | UI defect, non-blocking config bug                                       | 1 วันทำการ             |

---

## 2. ขั้นตอนตอบสนอง

1. **Detect** — alert จาก health check, auth failure spike, user report
2. **Triage** — กำหนด severity, มอบหมาย incident commander
3. **Contain** — revoke session (`tokenVersion++`), ปิด feature flag, read-only mode
4. **Eradicate** — patch, rollback deployment, หรือ restore DB
5. **Recover** — smoke test, parallel pilot ถ้าจำเป็น
6. **Post-mortem** — ภายใน 5 วันทำการ, action items มี owner

---

## 3. การสื่อสาร

| Audience          | ช่องทาง           | เนื้อหา                            |
| ----------------- | ---------------- | -------------------------------- |
| ทีม IT / dev       | Slack / ticket   | technical detail, correlation ID |
| ผู้จัดเวร / หัวหน้าแล็บ | โทร / LINE ภายใน | สถานะ, fallback roster           |
| บุคลากรทั่วไป        | in-app banner    | เวลาที่คาดว่ากลับมา (ไม่เปิดเผย PII)   |
| DPO / HR          | email            | เฉพาะ incident ที่กระทบข้อมูลส่วนบุคคล |

---

## 4. Runbook สั้น

### ระบบล่ม (502/503)

1. ตรวจ `/api/health` และ Neon status
2. ถ้า DB down → เริ่ม restore ตาม backup-restore
3. แจก fallback roster export ล่าสุด
4. เปิด incident ticket พร้อม correlation ID จาก logs

### สงสัย tenant leakage

1. **Contain ทันที** — ปิด endpoint ที่สงสัย, rotate secrets
2. เก็บ audit log + request logs (redacted)
3. แจ้ง DPO ภายใน 72 ชม. ถ้ามี personal data breach ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
4. รัน integration test tenant boundary หลัง patch

### Hard safety violation ใน published roster

1. **อย่า** ใช้ตารางนั้นเป็น official — rollback revision หรือ supersede
2. Root cause: config change, override class, หรือ validator bug
3. Revalidate ทั้ง revision ก่อน republish

### Auth attack / credential stuffing

1. ตรวจ `auth_login_rate_limited_total` และ `auth_login_failure_total`
2. เพิ่ม rate limit / block IP ที่ edge (Vercel WAF)
3. บังคับ password reset ถ้ามี account ถูก compromise

---

## 5. Observability ที่ใช้ triage

| Signal          | ที่มา                                        |
| --------------- | ------------------------------------------ |
| Correlation ID  | header `x-correlation-id`, structured logs |
| Auth failures   | metric `auth_login_failure_total`          |
| Rate limits     | metric `auth_login_rate_limited_total`     |
| DB latency      | health `latencyMs`, Neon dashboard         |
| Solver duration | metric `solver_run_duration_ms` (เมื่อเปิดใช้) |

Metrics endpoint: `/api/metrics` (ต้องมี `METRICS_TOKEN` ใน production)

---

## 6. Escalation

1. On-call engineer
2. Incident commander (IT lead)
3. หัวหน้าห้องแล็บ + DPO (SEV-1/2 ที่กระทบข้อมูล)
4. Vendor (Neon/Vercel support) ถ้า infrastructure

---

## 7. หลัง incident

- [ ] Post-mortem doc (ไม่ blame)
- [ ] อัปเดต threat model / runbook ถ้าจำเป็น
- [ ] เพิ่ม regression test ถ้าเป็น software defect
- [ ] Restore drill ซ้ำถ้าเกี่ยวกับ backup
