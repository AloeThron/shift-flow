# Pilot Pattern Laboratory — Starter Pack

ชุดตัวอย่างที่จำลอง **รูปแบบรหัสเวรซับซ้อน** (หลาย work area, night codes, prefix/suffix, alias) โดยใช้ข้อมูล **สมมติทั้งหมด**

> **คำเตือนสำคัญ:** pack นี้ **ไม่ใช่** ข้อมูลจากแล็บนำร่องจริง ไม่ map กับ `pilot-vault/` และไม่ควรใช้ production โดยไม่ปรับ  
> จุดประสงค์: ทดสอบ code parsing (regression) และ rule engine กับ pattern ใกล้ taxonomy ใน `docs/domain/shift-code-taxonomy.md`

## องค์กรสมมติ

- ชื่อ: Demo Pilot Pattern Laboratory
- Timezone: `Asia/Bangkok`
- บุคลากร: 12 คน (HEAD 1, MT 6, ASSISTANT 4, PT 1)

## Work areas (MI / IM แยก)

| Code | หมายเหตุ                                       |
| ---- | --------------------------------------------- |
| MI   | Microbiology bench (สมมติ)                     |
| IM   | Immunology bench (สมมติ) — **คนละ area กับ MI** |
| BB   | Blood bank                                    |
| CH   | Chemistry                                     |
| HE   | Hematology                                    |
| INC  | Incubator station — `needs_confirmation`      |
| Set  | Set lab — `needs_confirmation`                |

## รหัสที่ต้องยืนยัน (needs_confirmation)

- `INC`, `INC18`, `Set`, `N1`, `N2` — ตั้ง `needs_confirmation=true` ใน CSV (ใช้ทดสอบ parser/regression)

## ตารางเวรเดือนตัวอย่าง

ไฟล์ [`roster_month_sample.csv`](roster_month_sample.csv) — long format คน × วัน ทั้งเดือน ส.ค. 2026 (12 คน × 31 วัน)

- ใช้เมื่อ **seed** หรือกดนำเข้าชุดตัวอย่างใน `/settings`
- ระบบ publish เป็นตารางทั้งแผนก ดูได้ที่ `/schedule`
- รวม `off`, เวรกลางวันตาม area, และ night codes (`N1` / `N2` / `บด`) เป็นตัวอย่าง

## กติกา Stage A / Stage B

ใน [`rule_instances.yaml`](rule_instances.yaml) รวมชุด solver สองระยะ (ค่าสมมติ ปรับต่อ org ได้):

| Template                | ระยะ | บทบาท                                        |
| ----------------------- | ---- | -------------------------------------------- |
| `DAY_OFF_QUOTA`         | A    | โควตาวันหยุดต่อเดือน (เช่น 8 วัน/เดือน)             |
| `MAX_STAFF_OFF_PER_DAY` | A    | เพดานคนหยุดพร้อมกัน แยกวันธรรมดา/สุดสัปดาห์/นักขัตฤกษ์ |
| `FAIR_DISTRIBUTION`     | B    | soft fairness + convex cost                  |
| `OT_LIMIT`              | B    | เพดาน OT ต่อคนต่อเดือน (safety lock)            |

> ตาราง `roster_month_sample.csv` เป็นตัวอย่างมือ — ไม่รับประกันว่าผ่านทุก hard rule ของ Stage A (เช่น วันหยุดสุดสัปดาห์ทั้งแผนก)

## Edge cases ใน roster_import_sample.csv

- alias: `Inc` → `INC18`
- composite-style token: `Bac/MI2` (สมมติ)
- `?` สำหรับ UNKNOWN
- `off`, `ช` (head day code สมมติ)
