# Shift Code Taxonomy — พจนานุกรมรหัสเวรจากตารางจริง

> **สถานะ:** Discovery draft — อ้างอิงจาก OCR ชุด `pilot-vault/raw/ART-ROST-PHOTO-SET/` (8 เดือน + แผ่น OT); snapshot นิรนามใน `demo/validation-dataset/`  
> **Effective:** รอ sign-off Discovery Gate  
> **หมายเหตุสี:** ไฮไลต์แดง/พื้นแดงบนกระดาษ = marker เท่านั้น **ไม่ใช่** ShiftCode หรือ leave

---

## 1. หลักการ

1. หนึ่งเซลล์ = หนึ่ง `ShiftCode` ดิบ + ผล parse เป็น `Department` (แผนก) + เวลา hint
2. **`MI` และ `IM` เป็น Department คนละตัว** — ห้ามยุบหรือสลับตัวอักษร
3. รหัสที่ยังไม่ยืนยันหน้างาน ติด `needsConfirmation: true`

---

## 2. ไวยากรณ์ token

```text
[prefixStart][AREA][suffixEnd]
```

| ส่วน         | รูปแบบ               | ตัวอย่าง                 | ความหมาย (provisional)                |
| ----------- | ------------------- | ---------------------- | ------------------------------------- |
| prefixStart | `7` + `/` หรือ `7` นำ | `7BB`, `7/BB`, `7Bae`  | เริ่ม 07:00                             |
| prefixStart | ตัวเลข + `/`         | `8/16`, `F/16`, `B/17` | เริ่ม 08:00 / 16:00 / 17:00             |
| AREA        | ตัวอักษร              | `MI`, `IM`, `BB`, `CH` | Department (แผนก)                     |
| suffixEnd   | 2 หลักท้าย            | `MI20`, `IM18`, `HE20` | จบ 20:00 / 18:00                      |
| suffixEnd   | `/18`, `/20`        | `BB/18`, `HE/20`       | จบจาก slash notation                  |
| composite   | `/` กลาง            | `Bac/MI2`, `Inc/MI2`   | สอง area ในเซลล์เดียว — parse แยก token |

**Edge cases ที่ parser ต้องจับ:**

- `MI120` → น่าจะเป็น `MI20` (OCR) — `needsConfirmation`
- `ช` / `ซ` → กะหัวหน้า 08:00–16:00 (จาก legend ม.ค.)
- `Set` / `set` → canonical `Set`
- เซลล์ว่างในแถว PT = `NO_SHIFT` (ไม่ใช่ข้อมูลหาย)
- `?` = ยังไม่ถอด (`UNKNOWN`)

---

## 3. Department / แผนก (seed)

| Code   | ชื่อแสดง                   | พบ (ครั้ง) | บทบาทหลัก      | needsConfirmation |
| ------ | ------------------------ | -------: | ------------- | :---------------: |
| **MI** | Microbiology (ชื่อเต็ม TBC) |      ~76 | MT            |       ชื่อเต็ม       |
| **IM** | Immunology (ชื่อเต็ม TBC)   |      ~59 | MT, PT        |       ชื่อเต็ม       |
| BB     | Blood Bank               |     ~180 | MT            |                   |
| Bac    | Bacteriology             |     ~170 | MT            |                   |
| CH     | Chemistry                |     ~217 | MT            |                   |
| HE     | Hematology               |     ~208 | MT, หัวหน้า     |                   |
| INC    | Incubator / station      |     ~120 | MT            |    ความหมายจริง    |
| N1     | Night shift 1            |     ~230 | MT            |    กะ vs สถานี     |
| N2     | Night shift 2            |     ~218 | MT            |    กะ vs สถานี     |
| Set    | Set lab                  |      ~40 | MT, PT        |    ความหมายจริง    |
| F      | Front / counter          |      ~90 | ผู้ช่วย          |                   |
| B      | Set lab B                |      ~80 | ผู้ช่วย          |                   |
| cs     | CS station               |      ~60 | ผู้ช่วย          |                   |
| บด     | กะข้ามคืน                  |      ~55 | ผู้ช่วย          | crosses midnight  |
| CT     | CT duty                  |      ~35 | ผู้ช่วย (ส.ค.66) |                   |

**หัวหน้า:** ใช้ `ช`, `off`, `HE` เป็นหลัก — ไม่หมุนสถานีแบบ MT

---

## 4. ตาราง canonical (OCR variants เป็นหมายเหตุ discovery)

ระบบ runtime ใช้ **รหัส canonical เท่านั้น** — ไม่ map OCR variant เป็น entity แยก (เช่น `Bae`/`7HE` ไม่ auto-resolve เป็น `Bac`/`HE` ใน canvas หรือ fairness validation)

| Canonical | OCR variants ที่พบ (discovery)       | จำนวนครั้ง (รวม) | บทบาท     | ชม. (จาก OT sheet)   |
| --------- | ---------------------------------- | ------------: | --------- | -------------------- |
| off       | off                                |          1215 | ทุกกลุ่ม     | 0                    |
| N1        | N1                                 |           230 | MT        | 16                   |
| N2        | N2                                 |           218 | MT        | 14–16                |
| CH        | CH, CH18, 7CH                      |          217+ | MT        | 8–9                  |
| HE        | HE, HE18, HE20, 7HE                |          208+ | MT, หัวหน้า | 8–9                  |
| Bac       | Bac, Bae, Bae18, Bae20, 7Bac, 7Bae |          170+ | MT        | 8–12                 |
| BB        | BB, 7BB, BB18, BB20, 7BB18         |          180+ | MT        | 9–10                 |
| INC       | INC, Inc, INC18, INC20, 7INC       |          120+ | MT        | 8–9                  |
| MI        | MI, MI18, MI20, 7MI                |           76+ | MT        | 10–12                |
| IM        | IM, IM18, IM20, 7IM, IM/20         |           59+ | MT, PT    | 10                   |
| Set       | Set, set                           |            40 | MT, PT    | TBC                  |
| ช         | ช, ซ                               |           120 | หัวหน้า     | 8–16                 |
| F/16      | F/16, 8/16                         |           90+ | ผู้ช่วย      | 16                   |
| B/17      | B/17, B/16, 8/17                   |           80+ | ผู้ช่วย      | 17                   |
| cs/19     | cs/19, es/19                       |           60+ | ผู้ช่วย      | 19                   |
| บด        | บด, บต, บค, บศ                     |           55+ | ผู้ช่วย      | 16→08                |
| CT        | CT, CT/17                          |            35 | ผู้ช่วย      | TBC                  |
| sick      | sick                               |             3 | ผู้ช่วย      | leave                |
| VAC       | VAC                                |            0* | —         | leave (*legend only) |

---

## 5. เวลาเริ่ม–จบ (จาก legend ม.ค. + OT พ.ค.)

| รหัส legend / OT | เริ่ม           | จบ             |  crossesMidnight  |
| --------------- | ------------- | -------------- | :---------------: |
| 7/16, 7BB, 7Bac | 07:00         | 16:00–18:00    |                   |
| ช               | 08:00         | 16:00          |                   |
| 8/17, 8/20      | 08:00         | 17:00–20:00    |                   |
| F/16, B/16      | 08:00 / 16:00 | 16:00          |                   |
| cs/19           | 08:00         | 19:00          |                   |
| บด              | 16:00         | 08:00 (วันถัดไป) |         ✓         |
| N1              | TBC           | TBC            |        ✓?         |
| N2              | TBC           | TBC            |        ✓?         |
| Bac20           |               | 20:00          | 12 ชม. (OT sheet) |

---

## 6. ข้อจำกัด vocabulary ตามบทบาท (หลักฐาน OCR)

| บทบาท | รหัสที่ **ไม่เคย** พบ             | implication                         |
| ----- | ----------------------------- | ----------------------------------- |
| MT    | `F/16`, `B/17`, `บด`          | HC-003/004: competency แยกตาม grade |
| ผู้ช่วย  | `N1`, `N2`, `INC`, `CH`       | HC-003/004                          |
| หัวหน้า | `MI20`, `7BB`, rotation bench | pattern คนละชุด                      |
| PT    | sparse — เฉพาะวันทำงาน          | contract ไม่รับประกันชม.               |

---

## 7. สิ่งที่ **ไม่** อยู่ใน taxonomy

- สีพื้น/ไฮไลต์แดงบนกระดาษ → ไม่ map เป็นวันหยุด/leave
- `[แดง]` ใน CSV = marker OCR เท่านั้น → `UNKNOWN` หรือว่าง
- ตัวเลข tally RLA/ADM ในแผ่น OT → ไม่ใช่ ShiftCode

---

## 8. Change Log

| วันที่        | การเปลี่ยนแปลง                                                                              |
| ---------- | ----------------------------------------------------------------------------------------- |
| 2026-08-10 | สร้างจาก OCR 8 เดือน + OT; แยก MI/IM; 71 รหัสดิบ → ~20 canonical                              |
| 2026-08-11 | WorkArea → Department (แผนก); demand อยู่ที่ `ShiftCodeDemand` ไม่ใช่ coverage window           |
| 2026-08-11 | ถอด ShiftCodeAlias จาก runtime — canonical code เท่านั้น; OCR variants เก็บเป็น discovery note |
