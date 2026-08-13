# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Admin UI จัดการสิทธิปฏิบัติงานตามรหัสเวรบน `/settings/staff` (checkbox + ทุกรหัสเวร)
- Parallel pilot runbook with go-live gate and rollback procedure (`docs/pilot/parallel-pilot.md`)
- Go-live gate evaluator (`src/domain/pilot/`) and `pnpm pilot:evaluate` CLI
- Simulated 2-cycle shadow reports for gate testing (`demo/pilot-shadow/`)
- Open Source foundation: MIT license, governance, security policy, contribution guide
- GitHub CI workflow และ issue template Rule Template Request
- Synthetic demo data and starter packs in `demo/starter-packs/`
- Domain documentation: configuration model and rule template registry

### Changed

- **Breaking:** ลบ model `Competency` และ `StaffCompetencyAuthorization` — สิทธิปฏิบัติงานผูก `StaffShiftAuthorization` ต่อ `shiftCodeId` โดยตรง; ไม่ migrate ข้อมูลเดิม (ใช้ starter pack + admin UI ตั้งใหม่)
- ลบ `requiredCompetencyId` จาก `ShiftCodeDemand` และ `requiredCompetencyIds` จาก `ShiftTemplate`
- Starter pack: MT staff มีสิทธิครบ demand weekday โดยไม่หมดอายุ; N1-MI/N1-IM ปิด needsConfirmation
- Stage B error แยก block reason (สิทธิรหัสเวร / grade / Stage A) ในข้อความ unfilled mandatory
- `authCoversShiftCode` นับวันหมดอายุ inclusive ถึงสิ้นวัน local
- Stage B ตรวจสิทธิตาม `shiftCodeId` (`shift-auth.ts`); block reason `SHIFT_AUTH`
- Rule `REQUIRED_COMPETENCY_IN_SHIFT` ยังใช้ template id เดิม — ตรวจสอบสิทธิรหัสเวรของ assignment
- Stage B min-cost flow: convex ladder ต่อคน (หน่วยเวร) บน arc staff→sink; fill ใช้ fillPool→fillCode ladder กระจายรหัส; soft penalty หมุน work area ผ่าน Lagrangian
- Discovery gate reframed: Engine Gate passed; site-specific values become org config
- รวม `docs/privacy/` เป็นไฟล์เดียว (`data-policy.md`); ตัดโมเดล Competency ที่ถูกลบแล้ว
- ย่อ discovery ให้เหลือ clarification-requests + artifact-inventory; changelog ดูแลด้วยมือ
- Contribution: commit สั้นเน้นเหตุผล; branch จาก `main`; checklist เหลือ tests / CHANGELOG / ไม่มี PII; issue ว่างได้ ยกเว้น rule template และช่องโหว่ตาม SECURITY.md
- CI: job `e2e` วิ่งขนานกับ quality หลัง `e2e-gate`; ข้ามเมื่อเปลี่ยนเฉพาะ docs / changelog / markdown ราก / `.agents/` / issue template; quality ไม่รัน `pnpm build` (มีใน e2e) และไม่รัน `pnpm audit`

### Removed

- Competency master panel และ CRUD actions
- `competencies.csv` จาก starter pack
- แม่แบบสัมภาษณ์ discovery, stakeholders, บันทึก `INT-SCH-001` จำลอง, `docs/pilot/baseline.md` ค่าจำลอง
- Issue template `config_question`, `bug_report`, `feature_request`; PR template; Dependabot — เหลือ CI + Rule Template Request
- Changesets — ใช้ `CHANGELOG.md` ด้วยมือ

## [0.0.0] - 2026-08-10

### Added

- Initial discovery artifacts: shift code taxonomy, domain model draft, constraint catalog
- Pilot vault structure (local, gitignored) and roster artifact build script
- AGENTS.md for AI-assisted development

[Unreleased]: https://github.com/AloeThron/shift-flow/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/AloeThron/shift-flow/releases/tag/v0.0.0
