# Optimization Model — โมเดลคณิตศาสตร์การจัดเวร

> **สถานะ:** ร่างสถาปัตยกรรม — คู่กับ [scheduling-workflow.md](./scheduling-workflow.md)  
> **อัปเดต:** 2026-08-11  
> **โค้ดเป้าหมาย:** `src/domain/optimize/`

---

## 1. บทบาทของโมเดล

Shift-Flow ใช้ solver สองระยะภายใต้การควบคุมของผู้จัดเวร:

| ระยะ                  | ปัญหา                        | วิธีแก้หลัก                                         |
| --------------------- | --------------------------- | ----------------------------------------------- |
| **Stage A — ลงวันหยุด** | transportation ระหว่างคนกับวัน | sequential greedy spacing + ต้นทุน gap แบบสด      |
| **Stage B — เกลี่ยงาน** | จับคู่ slot กับคน               | min-cost flow + convex cost + Lagrangian repair |

โมเดลนี้ **ไม่** อ้างว่า optimal ของ relaxation = optimal ของปัญหาจริงเมื่อมีข้อจำกัดเชิงลำดับ (min rest, forbidden sequence, consecutive nights/days, rolling hours) — ข้อจำกัดเหล่านั้น flow-representable ไม่ครบ จึงปิดช่องด้วย Lagrangian repair, targeted local search และ **validator อิสระ** ก่อน commit

---

## 2. กรอบเวลาและข้อมูลป้อนเข้า

ค่าต่อองค์กร (ดู [configuration-model.md](./configuration-model.md) — `SchedulingPolicy`):

| พารามิเตอร์                | ค่าเริ่มต้น starter pack | ความหมาย                                                |
| ------------------------ | -------------------- | ------------------------------------------------------- |
| `historyWindowMonths`    | 6                    | หน้าต่าง query รายละเอียดเต็ม (assignment, OT, วันหยุด, swap) |
| `fairnessLookbackMonths` | 6                    | ช่วง carry-over สำหรับ convex cost และรายงานความเป็นธรรม    |
| `planningHorizonMonths`  | 1                    | รอบที่เปิดแก้ได้พร้อมกัน (มัก = 1 เดือน)                         |
| `publishLeadDays`        | org-specific         | วันก่อนเริ่มรอบที่ต้อง publish — ใช้ pilot gate                 |

**Carry-over:** ขั้นบันไดต้นทุน convex ของ Stage B เริ่มจากภาระสะสม `fairnessLookbackMonths` ย้อนหลัง (จาก `StaffWorkloadMonthly` + รอบที่กำลังจัด) ไม่ reset ทุกเดือน

**Determinism:** ทุกต้นทุนเป็น **จำนวนเต็ม** (ชั่วโมง × 100), arc order คงที่, tie-break ด้วย id — ผลเดิมจาก input เดิมโดยไม่พึ่ง seed

---

## 3. ตัวแปรและโครงสร้างกราฟ

### 3.1 Stage A — วันหยุด (Day-off planning)

**Solver:** `stage-a-sequential-spacing@1` — global greedy sequential assign แทน pure min-cost flow เพื่อ couple วันหยุดหลายวันของคนเดียวกันในรอบเดียว

**ลำดับ solve**

1. **Seed** — วาง fixed (`PlannedNonWorkingDay.locked`, `source = MANUAL`, `source = REQUEST`) ลง state; หัก quota และ capacity ต่อวัน×scope — **`QUOTA` unlocked จากรอบก่อนไม่ seed** (ให้เกลียใหม่)
2. **Loop** — จนกว่าทุก staff ครบโควตา:
   - สкан `(staff, date)` ที่ feasible ทั้งหมด
   - คำนวณต้นทุนด้วย `priorDates = historical + fixed + assignedInCycle`
   - เลือกคู่ cost ต่ำสุด; tie-break `staffId` แล้ว `localDate` (deterministic)
   - commit: อัปเดต `assignedInCycle`, `remainingQuota`, `remainingCapacity`
3. **Output** — แปลงเป็น `PlannedNonWorkingDay` (source: `QUOTA` | `REQUEST` | `MANUAL`)

**โหนด/ข้อจำกัด (conceptual — ไม่ build กราฟ MCF แล้ว)**

- Staff \(s \in S\) — แต่ละคนใน `StaffGroup` ที่อยู่ในขอบเขตรอบ
- Day \(d \in D\) — วันในรอบที่กำลังจัด
- โควตาต่อคน — จาก `DAY_OFF_QUOTA`
- เพดานต่อวัน×scope — จาก `MAX_STAFF_OFF_PER_DAY`

**Arc บังคับ (fixed ก่อน loop)**

- วันลาที่ `LeaveRequest` อนุมัติแล้ว — ไม่ใช่ตัวแปร
- วันหยุด `PlannedNonWorkingDay` ที่ `locked = true`, `source = MANUAL`, หรือ `source = REQUEST`
- **`QUOTA` unlocked ไม่ fixed** — re-run เกลียแทนที่ได้

**Output pass-through:** fixed ข้างต้น + วันใหม่ที่ greedy assign (`source = QUOTA` หรือ `REQUEST` จาก cost preference)

**ต้นทุนต่อ `(staff, date)`** (รวมเป็นจำนวนเต็ม):

\[
c_{s,d} = w_{base} + w_{req} \cdot \mathbb{1}[\text{staff ขอวัน } d] + w_{gap} \cdot g_{s,d} + w_{wknd} \cdot h_{s,d}
\]

| สัญลักษณ์      | ที่มา                                                            |
| ----------- | -------------------------------------------------------------- |
| \(w_{req}\) | น้ำหนักคำขอวันหยุด (soft preference / rule instance)                 |
| \(g_{s,d}\) | ระยะห่างจากวันหยุดครั้งก่อน — `idealGap = max(1, ⌊cycleDays/quota⌋)` |
| \(h_{s,d}\) | สัดส่วนวันหยุดสุดสัปดาห์ที่ยังขาดของคน \(s\)                             |

**Feasible ต่อ `(staff, date)`:** ยังมี quota เหลือ, ไม่ blocked จาก assignment ทำงาน, ไม่มี fixed อยู่แล้ว, capacity วัน×scope ยังเหลือ

**Infeasible:** loop จบแต่ quota ยังเหลือ → `feasible: false` (preflight + capacity check เหมือนเดิม)

**Determinism:** staff sort `id.localeCompare`, candidate sort `(cost, staffId, localDate)`, ไม่ใช้ random seed

**ผลลัพธ์:** วันที่ถูก assign → `PlannedNonWorkingDay` (source: `QUOTA` | `REQUEST` | `MANUAL`)

### 3.2 Stage B — เกลียงาน (Balance)

**โหนด**

- Source / Sink
- Slot node \(k\) — **MANDATORY** จาก `ShiftCodeDemand` (lower bound = 1)
- FillPool node \(d\) — สรุปจำนวน fill ต่อวัน (`count` = staff ว่าง − mandatory ของวันนั้น)
- FillCode node \((d, c)\) — รหัสเวรที่เลือกได้สำหรับ fill ในวัน \(d\)
- StaffDay node \((s, d)\) — capacity = 1 (บังคับ **หนึ่งเวรต่อคนต่อวัน**)
- Staff node \(s\) — convex ladder ต่อคน (หน่วย**เวร** ไม่ใช่ชั่วโมง) ไป sink

**โครงสร้าง arc**

```
source ──lb=1──► mandatory slot ──shiftCodeId──► staffDay(s,d) ──► staff(s) ──► sink (convex ladder หน่วยเวร)
source ──ub=count(d)──► fillPool(d) ──ladder ต่อรหัส──► fillCode(d,c) ──► staffDay(s,d) ──► staff(s) ──► sink
source ──relief ub=Σ fill, cost=FILL_SKIP_PENALTY──► sink
```

- **MANDATORY:** ทุก slot จาก demand เป็น `MANDATORY` เสมอ — แม้รหัสมี `otHours > 0` (ยกเลิก OT slot แยกต่อ `(วัน, รหัส)`)
- **FILL:** เปิดด้วย `fillEveryAvailableCell` (default `true`) — ต่อวันสร้าง **fill pool** จำนวน `(staff ที่ไม่หยุด/ลา/มีเวรแล้ว) − mandatory ของวันนั้น`; arc `fillPool → fillCode` ใช้ convex ladder ต่อรหัส (`toleranceUnits = 1`) เพื่อกระจายรหัสเท่ากันภายในวัน; solver เลือก staff ผ่าน arc `fillCode → staffDay`
- **Relief arc** `source → sink`: ให้ข้าม fill slot ได้ (ต้นทุน `FILL_SKIP_PENALTY`) — สูงกว่าต้นทุนเติมปกติ แต่ต่ำกว่า `OT_SLOT_BASE_PENALTY + otHours×100` บน arc ที่ชี้รหัส OT
- **Competency:** รหัสที่มี `ShiftCodeDemand` สืบทอด `requiredCompetencyId` ไป fill arc ด้วย; รหัสที่ไม่มี demand ตรวจเฉพาะ `allowedGradeIds`
- เซลล์ `Assignment.isPinned = true` และวันหยุด `PlannedNonWorkingDay.locked` — **ตัด arc ออก** ก่อน solve

**Convex cost ต่อ staff:** ต้นทุนสะสมบน arc `staff(s) → sink` เป็น piecewise-linear convex **หน่วยเวร** (flow unit = 1 เวร):

\[
C_s(h) = \sum_{i=1}^{h} c_s(i), \quad c_s(i) \leq c_s(i+1)
\]

จุดเริ่มขั้นบันได = carry-over แปลงจากชั่วโมงเป็นหน่วยเวร (`offset / avgShiftHours`) — ดู §5

**Convex cost ต่อรหัส fill:** arc `fillPool(d) → fillCode(d,c)` ใช้ ladder แยกต่อรหัส — ครั้งที่ 2 ของรหัสเดิมในวันเดียวกันแพงกว่าครั้งแรกของรหัสอื่น → กระจายรหัสภายในวัน

**Arc มอบหมาย** (`slot/fillCode → staffDay`): ต้นทุน = ผลต่างชั่วโมงมาตรฐาน + penalty OT + Lagrangian adjustment (รวม soft หมุน work area)

---

## 4. การแปลง convex cost เป็น min-cost flow

ฟังก์ชัน `convex-cost.ts` แปลง \(C_s\) เป็น **parallel arcs** ต้นทุนไล่ระดับ:

- เวรที่ 1 หลัง offset: cost \(c_s(h_0+1)\)
- เวรที่ 2: cost \(c_s(h_0+2)\)
- … จนถึงเพดาน capacity (`resolveStaffMaxShifts`)

Ladder บน `fillPool → fillCode` ใช้ `toleranceUnits = 1` — แต่ละ tier = 1 ครั้งที่เลือกรหัสนั้นในวัน

min-cost flow บนกราฟ integral ให้การจัดสรรที่ **optimal ต่อ objective convex นั้น** — วิธีมาตรฐาน min-max fairness บนกราฟ

**Tolerance:** `FAIR_DISTRIBUTION.toleranceHours` กำหนดความกว้างขั้นบันได — แคบเกิน → demand ขาด; admin UI ต้อง preview ผลกระทบก่อนบันทึก

---

## 5. Carry-over จากประวัติ 6 เดือน

`fairness/carry-over.ts` อ่าน `StaffWorkloadMonthly` ย้อนหลัง `fairnessLookbackMonths`:

1. เลือก dimension ตาม `FAIR_DISTRIBUTION.dimension` (`TOTAL_HOURS`, `OT_HOURS`, `NIGHT_SHIFTS`, …)
2. ถ่วงน้ำหนักเดือนที่ใกล้กว่ามากกว่า (linear decay หรือ equal weight — กำหนดใน rule instance)
3. Normalize ด้วย `fteAtPeriod` ของแต่ละเดือน (`normalizeByFte`)
4. คำนวณ offset \(h_0(s)\) = สะสมเทียบค่ากลางของ `StaffGroup`

คนที่สะสมมากกว่าค่ากลาง → เริ่มที่ขั้นต้นทุนแพงกว่า → Stage B ดึงงานออกโดยอัตโนมัติ

**ข้อมูลไม่ครบ:** คนเข้าใหม่ / ลาคลอด / เปลี่ยน FTE — normalize ด้วยจำนวนเดือนที่มีข้อมูลจริง; ห้ามลงโทษหรือให้เปรียบเมื่อไม่มีประวัติ (baseline = ค่ากลางกลุ่ม)

---

## 6. Min-cost flow — อัลกอริทึม

`flow/min-cost-flow.ts`:

- **Successive shortest path** พร้อม **node potentials (Johnson)**
- ต้นทุน arc: **integer** เท่านั้น (scale = 100 ต่อชั่วโมง)
- Flow conservation บนทุกโหนดกลาง
- Replay: input snapshot + solver version → byte-equal output

**เหตุผลที่ integral:** ความต้องการ demand และโควตาวันหยุดเป็นจำนวนเต็ม; ต้นทุน convex แปลงเป็นขั้นบันไดจำนวนเต็ม; ไม่ใช้ floating point ใน objective

---

## 7. Lagrangian repair — ข้อจำกัดที่ flow แทนไม่ได้

`lagrangian/subgradient.ts` — สามชั้น:

| ชั้น             | การทำ                                                            | ตัวอย่างข้อจำกัด                                        |
| -------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| 1 — ตัด arc     | ละเมิดแน่นอน → ไม่สร้าง arc                                         | overlap กับ assignment ที่ pin, ลาอนุมัติ                |
| 2 — multiplier | เพิ่มต้นทุน arc ที่ละเมิด soft / กอง work area แล้ว re-solve จำนวนรอบคงที่ | min rest, forbidden sequence, area rotation (soft) |
| 3 — repair     | ส่ง violation ที่เหลือให้ local search + validator                   | consecutive nights/days, rolling hours             |

ข้อจำกัด HC-005–HC-008, `MAX_CONSECUTIVE_DAYS` อยู่ชั้น 2–3 เป็นหลัก

**Work area rotation (soft):** นับ assignment ต่อ `(staffId, departmentId)` — คู่ที่เกิน `ceil(areaSlotTotal / eligibleStaffCount)` ได้รับ `ArcCostAdjustment` ใน subgradient; loop หยุดเมื่อ hard valid, soft violations ว่าง **และ** area สมดุล

---

## 8. Objective แบบ lexicographic

ลำดับชั้น (หยุดเมื่อชั้นบน tie หรือ infeasible ชัดเจน):

1. **Hard feasibility** — ไม่มี HARD violation หลัง validator
2. **Demand gap** — ลดจำนวน slot บังคับ (`ShiftCodeDemand`) ที่ว่าง
3. **OT spread** — ลด max−min OT ต่อ `StaffGroup` (ถ้าเปิด `OT_LIMIT` + `FAIR_DISTRIBUTION` dimension `OT_HOURS`)
4. **Hour spread** — ลด max−min ชั่วโมงต่อกลุ่ม
5. **Preference** — คำขอวันหยุด, `PREFERRED_PATTERN`

น้ำหนักแต่ละชั้นอ่านจาก `RuleInstance.weight` — **ไม่ฝังในโค้ด**

---

## 9. Planned OT

OT ใน Shift-Flow แยกสองชั้น:

| ชั้น         | Entity / ฟิลด์                                  | บทบาท                                                    |
| ---------- | --------------------------------------------- | -------------------------------------------------------- |
| รหัสเวร     | `ShiftCode.otHours`, `ShiftCode.isNightShift` | ชม. OT ที่มากับรหัส — ไม่เดาจากชื่อ                             |
| การมอบหมาย | `Assignment.plannedOtHours`                   | OT ที่วางแผนในเซลล์ตาราง — ตัวแปรของ Stage B และสถิติ workload |

`SchedulingPolicy.otDerivationMode` กำหนดว่า UI/solver derive OT จากรหัสอย่างเดียวหรือให้แก้ `plannedOtHours` ใน canvas ได้

เพดาน: `OT_LIMIT` (`maxOtHoursPerStaffPerCycle`, `maxOtHoursPerOrgPerCycle`)

---

## 10. Fairness metrics (รายงาน + soft validator)

`fairness/metrics.ts` — คำนวณต่อ `StaffGroup`:

| Metric         | นิยาม                                     |
| -------------- | ---------------------------------------- |
| spread         | max − min ของ dimension ที่เลือก            |
| spread per FTE | spread หลัง normalize                     |
| Gini           | ไม่สมมาตรของการกระจาย (optional ในรายงาน) |

ใช้ทั้งใน `FAIR_DISTRIBUTION` validator และแผง canvas/workload — **ตัวเลขเดียวกัน** กับที่ solver ใช้

---

## 11. โมดูลโค้ด (เป้าหมาย)

| Path                          | หน้าที่                                       |
| ----------------------------- | ------------------------------------------ |
| `flow/min-cost-flow.ts`       | SSP + potentials, integer cost             |
| `flow/convex-cost.ts`         | parallel arcs, สร้างขั้นบันไดจาก tolerance     |
| `day-off/plan-day-off.ts`     | sequential greedy Stage A                  |
| `balance/build-slot-graph.ts` | สร้าง slot MANDATORY จาก demand + FILL ต่อวัน |
| `balance/solve-balance.ts`    | กราฟ Stage B + flow                        |
| `lagrangian/subgradient.ts`   | multiplier + re-solve                      |
| `fairness/metrics.ts`         | spread, Gini                               |
| `fairness/carry-over.ts`      | offset จาก `StaffWorkloadMonthly`          |

---

## 12. เกณฑ์ทดสอบ (อ้างอิง)

- Unit: min-cost flow เทียบ brute force บน instance เล็ก
- Convex cost: spread ไม่แย่กว่า greedy เดิมบน `demo/validation-dataset/`
- Property: flow conservation, ผลเดิม byte-equal, วันหยุด locked ไม่เปลี่ยน
- Golden: snapshot fairness metric ต่อกลุ่ม — lookback 6 เดือน vs คิดเฉพาะรอบเดียว

---

## 13. Change Log

| วันที่        | การเปลี่ยนแปลง                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 2026-08-11 | Stage B: fillPool→fillCode ladder; convex ladder ต่อคนเป็นหน่วยเวร; area rotation soft ผ่าน Lagrangian     |
| 2026-08-11 | Stage B: fill slot + staffDay node + relief arc; MANDATORY จาก demand เสมอ; competency สืบทอดจาก demand |
| 2026-08-11 | สร้างเอกสารโมเดลสองระยะ, convex cost, carry-over, planned OT, determinism                               |
| 2026-08-11 | slot จาก `ShiftCodeDemand` ต่อรหัสเวร — ไม่ใช้ coverage overlap window×area                                |
