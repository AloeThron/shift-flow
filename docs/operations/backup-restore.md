# Backup & Restore — Shift-Flow

> อัปเดต: 2026-08-10  
> เป้าหมาย pilot: **RPO 24 ชม.** / **RTO 4 ชม.**

---

## 1. ขอบเขตข้อมูล

| ข้อมูล                                    | ที่เก็บ                                  | ความสำคัญ       |
| --------------------------------------- | ------------------------------------- | ------------- |
| ตารางเวร, config, audit                 | PostgreSQL (Neon production)          | สูง            |
| บัญชีผู้ใช้, membership                      | PostgreSQL                            | สูง            |
| Secrets (`AUTH_SECRET`, DB credentials) | Vercel / secret manager               | สูง            |
| ไฟล์ raw จาก pilot                       | `pilot-vault/raw/` (local, gitignore) | กลาง          |
| Export ฉุกเฉินล่าสุด                        | ควบคุมสิทธิ์โดยหัวหน้าเวร                   | สูง (fallback) |

**ไม่เก็บ:** ข้อมูลผู้ป่วย, ผลตรวจ, PHI

---

## 2. กลยุทธ์สำรองข้อมูล

### Production (Neon)

1. **Point-in-Time Recovery (PITR)** — เปิดใช้บน Neon production branch (window ≥ 24 ชม.)
2. **Logical backup รายวัน** — `pg_dump` แบบ encrypted ไปยัง object storage คนละระบบกับ primary DB
3. **Config snapshot** — export rule instance / shift code ผ่าน admin UI หรือ starter-pack YAML เป็น secondary copy

### Local / Staging

- ใช้ `scripts/backup-restore-drill.sh` กับ PostgreSQL ใน Compose
- เก็บ dump ใน path ที่ gitignore (`backups/`)

---

## 3. Restore Procedure

### 3.1 Neon PITR (preferred)

1. ยืนยัน incident และแจ้ง stakeholders ตาม [`incident-response.md`](incident-response.md)
2. สร้าง branch ใหม่จากจุดเวลาก่อน incident ใน Neon Console
3. อัปเดต `DATABASE_URL` / `DIRECT_URL` ใน staging แล้วรัน smoke test
4. รัน `pnpm db:migrate:deploy` ถ้า schema ไม่ตรง
5. สลับ production connection หลัง sign-off
6. บันทึก post-mortem และอัปเดต RPO/RTO จริง

### 3.2 Logical restore (`pg_dump`)

```bash
# restore จากไฟล์ dump
pg_restore --clean --if-exists --no-owner \
  --dbname="$DATABASE_URL" \
  backups/shiftflow-YYYYMMDD-HHMM.dump
pnpm db:migrate:deploy
pnpm test
```

### 3.3 Fallback roster

เมื่อระบบล่มและ DB restore ยังไม่เสร็จ:

1. ใช้ **published roster export ล่าสุด** (CSV/PDF) ที่หัวหน้าเวรเข้าถึงได้
2. ไม่แก้ไขตารางใน Excel เป็น source of truth จนกว่าระบบกลับมา
3. หลัง restore — reconcile manual changes กับ audit log

---

## 4. Restore Drill (ก่อน go-live)

Checklist ที่ต้องผ่าน:

- [ ] สร้าง logical backup จาก staging DB
- [ ] Restore ลง database ว่างใน environment แยก
- [ ] รัน migration + seed smoke
- [ ] Login + ดู published roster สำเร็จ
- [ ] วัดเวลา restore ทั้งหมด ≤ **4 ชั่วโมง** (RTO)
- [ ] ยืนยัน backup ล่าสุดไม่เก่ากว่า **24 ชั่วโมง** (RPO)

รัน drill:

```bash
./scripts/backup-restore-drill.sh
```

---

## 5. การทดสอบอัตโนมัติที่เกี่ยวข้อง

| Gate                        | ที่อยู่                                              |
| --------------------------- | ------------------------------------------------ |
| Migration deploy บน test DB | CI `pnpm db:migrate:deploy`                      |
| Tenant boundary integration | `tests/integration/tenant-boundary.test.ts`      |
| Health + DB connectivity    | `src/app/api/health/route.ts`, E2E security spec |

---

## 6. Owner

| หน้าที่                 | Owner (กำหนดตอน go-live) |
| -------------------- | ----------------------- |
| Backup policy        | IT / DPO                |
| Restore execution    | IT + ผู้ดูแลระบบ           |
| Fallback roster      | หัวหน้าเวร / Scheduler    |
| Sign-off หลัง restore | หัวหน้าห้องแล็บ + IT        |
