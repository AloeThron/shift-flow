# RBAC — Role-Based Access Control

> **สถานะ:** two-role consolidation (tenant-domain phase)  
> **อัปเดต:** 2026-08-11  
> **อ้างอิง:** `OrganizationRole` ใน `prisma/schema.prisma`, `src/domain/rbac/permissions.ts`

---

## 1. โมเดลตัวตน

| Entity                   | บทบาท                                   |
| ------------------------ | --------------------------------------- |
| `User`                   | ตัวตน global — ไม่ผูก tenant โดยตรง        |
| `Organization`           | tenant                                  |
| `OrganizationMembership` | เชื่อม user ↔ org พร้อม `OrganizationRole` |

การตรวจสิทธิ์ privileged action ต้องอ่าน membership จาก DB ทุกครั้ง — **ไม่เชื่อ** `organizationId` หรือ `role` จาก request body โดยตรง

**บุคลากรไม่มีบัญชี login แยก** — ดูตารางเวรผ่าน **ลิงก์แชร์ read-only** (`/s/{token}`) ที่ผู้จัดเวรสร้างหลัง publish

---

## 2. บทบาท (สองบทบาท)

| Role           | คำอธิบาย                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `SYSTEM_ADMIN` | ตั้งค่าองค์กร, ผู้ใช้, config ทั้งหมด, membership                         |
| `SCHEDULER`    | จัดตาราง canvas, solver, publish, สร้าง/เพิกถอนลิงก์แชร์, override มี audit |

> **หมายเหตุ:** บทบาท `APPROVER`, `STAFF`, `PAYROLL_VIEWER`, `AUDITOR` ถูกถอดออกจาก enum — workflow ลา/สลับ/coverage/รับทราบ ย้ายไปอยู่ใน canvas popup และ share link แทน

---

## 3. Permission Matrix

| Permission             | SYSTEM_ADMIN | SCHEDULER |
| ---------------------- | :----------: | :-------: |
| `org:config:read`      |      ✓       |     ✓     |
| `org:config:write`     |      ✓       |           |
| `schedule:read`        |      ✓       |     ✓     |
| `schedule:draft:write` |      ✓       |     ✓     |
| `schedule:publish`     |      ✓       |     ✓     |
| `schedule:share`       |      ✓       |     ✓     |

**การใช้งานในโค้ด:**

| Permission             | จุดใช้หลัก                                              |
| ---------------------- | ------------------------------------------------------- |
| `schedule:read`        | หน้า canvas, workload                                   |
| `schedule:draft:write` | แก้เซลล์, solver, pin/lock                              |
| `schedule:publish`     | `publishScheduleAction` — snapshot draft → version      |
| `schedule:share`       | `createShareLinkAction`, `revokeShareLinkAction`, รายการลิงก์ |

---

## 4. Override Class vs Role

| Override Class      | ใครทำได้ในระบบปัจจุบัน                         | เงื่อนไข                          |
| ------------------- | ---------------------------------------------- | --------------------------------- |
| `NEVER`             | ไม่มีใคร — engine ปฏิเสธเสมอ                    | —                                 |
| `APPROVER_REQUIRED` | `SCHEDULER` หรือ `SYSTEM_ADMIN`               | ต้องระบุเหตุผล + บันทึก `AuditEvent` |
| `SCHEDULER_ALLOWED` | `SCHEDULER` ขึ้นไป                              | แนะนำระบุเหตุผล (soft override)   |

Override ทำได้จาก **popup canvas** (รหัสที่ถูกบล็อก) หรือ **แผง publish** (hard violation ก่อนเผยแพร่) — ไม่มี workflow อนุมัติแยก role

---

## 5. Share Link Security

ลิงก์แชร์ (`ScheduleShareLink`) ให้บุคลากรดูตารางเผยแพร่โดยไม่ login

| หัวข้อ              | การ implement                                                                 |
| ------------------- | ----------------------------------------------------------------------------- |
| **Token**           | `randomBytes(32)` → base64url — ส่งให้ผู้ใช้ครั้งเดียวตอนสร้าง/publish       |
| **Storage**         | เก็บเฉพาะ `tokenHash` = SHA-256 hex — ไม่เก็บ token plain ใน DB               |
| **Expiry**          | `expiresAt` ตั้งได้ 1–365 วัน (default 90) — ตรวจด้วย `isShareLinkActive()`   |
| **Revoke**          | `revokedAt` ไม่ null → ลิงก์ใช้ไม่ได้ทันที; audit `share-link:revoke:{id}`     |
| **noindex**         | middleware ตั้ง `X-Robots-Tag: noindex, nofollow` สำหรับ `/s/*`               |
| **Cache**           | `Cache-Control: no-store` บนเส้นทาง share                                     |
| **ข้อมูลที่แสดง**   | allowlist: `displayName` + รหัสเวร/วันหยุด + ช่วงเวลา — **ไม่** ส่ง email, staffCode, competency, OT รายละเอียด |
| **สิทธิ์จัดการ**    | สร้าง/เพิกถอน: `schedule:share` — หน้า `/s/{token}` ไม่ต้อง auth              |
| **View tracking**   | `viewCount`, `lastViewedAt` อัปเดตเมื่อโหลดสำเร็จ (ไม่ log token)              |

**เส้นทางโค้ด:** `src/domain/schedule/share/token.ts`, `src/actions/schedule/share.ts`, `src/lib/scheduling/load-published-share-view.ts`, `src/middleware.ts`

---

## 6. การใช้งานในโค้ด

```typescript
import { hasPermission } from "@/domain/rbac";
import type { OrganizationContext } from "@/domain/tenant";

const ctx: OrganizationContext = {
  organizationId: membership.organizationId,
  userId: user.id,
  role: membership.role,
};

if (!hasPermission(ctx, "schedule:share")) {
  throw new ForbiddenError();
}
```

---

## 7. Tenant Boundary

- ทุก query/mutation ผ่าน `createScopedRepository(ctx)` — inject `organizationId` อัตโนมัติ
- raw `prisma` client ไม่ export ไปชั้น Server Action (ยกเว้น share lookup ที่ hash token แล้ว)
- integration test ต้องพิสูจน์ cross-tenant read/write ถูกปฏิเสธ

---

## 8. Change Log

| วันที่     | การเปลี่ยนแปลง                                      |
| ---------- | --------------------------------------------------- |
| 2026-08-10 | matrix หลายบทบาท (ร่าง tenant-domain)               |
| 2026-08-11 | รวมเป็น 2 role + `schedule:share` + share link security |
