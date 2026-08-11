# Pilot Shadow Reports — รายงานทดสอบคู่ขนาน

ชุด JSON สำหรับ **ทดสอบ go-live gate evaluator** และสคริปต์ `pnpm pilot:evaluate`  
**ไม่ใช่** ผล pilot หน้างานจริง — ใช้จำลอง flow 2 รอบ shadow ตาม [`docs/pilot/parallel-pilot.md`](../../docs/pilot/parallel-pilot.md)

---

## ไฟล์

| ไฟล์                                    | คำอธิบาย                                        |
| -------------------------------------- | --------------------------------------------- |
| `reports/simulated-passing-pilot.json` | 2 รอบ shadow ผ่านเกณฑ์ go-live ทั้งหมด            |
| `reports/simulated-failing-pilot.json` | 2 รอบ shadow ล้ม blocking gate → แนะนำ rollback |
| `reports/cycle-template.json`          | แม่แบบกรอกรอบ shadow ใหม่                       |

---

## การประเมิน

```bash
# รายงานจำลองที่ผ่าน
pnpm pilot:evaluate demo/pilot-shadow/reports/simulated-passing-pilot.json

# รายงานจำลองที่ล้ม (rollback)
pnpm pilot:evaluate demo/pilot-shadow/reports/simulated-failing-pilot.json
```

Exit code: `0` = ผ่าน go-live, `1` = ไม่ผ่านหรือ schema ไม่ถูกต้อง

---

## นโยบาย

1. รายงาน pilot จริงเก็บ **นอก repo** (local หรือ secure storage) — มี PII
2. ก่อน commit ตัวอย่าง ตรวจว่าไม่มีชื่อจริง รหัสพนักงานจริง
3. รอบ shadow **ห้าม** publish เป็น official จนกว่าผู้อนุมัติลงนาม go-live
