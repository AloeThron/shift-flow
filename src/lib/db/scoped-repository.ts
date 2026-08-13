import type { OrganizationContext } from "@/domain/tenant/organization-context";
import type { Prisma, PrismaClient } from "@/generated/client/client";

/** data สำหรับ create ที่ inject organizationId ภายหลัง */
type TenantCreateData<T extends { organizationId?: string }> = Omit<T, "organizationId">;

/** โมเดลที่ tenant-owned — ใช้กับ scoped repository */
export const TENANT_OWNED_MODELS = [
  "department",
  "staffGrade",
  "staffProfile",
  "employmentContract",
  "staffShiftAuthorization",
  "nonWorkingDayKind",
  "shiftCode",
  "shiftTemplate",
  "shiftInstance",
  "codeParsingRule",
  "shiftCodeDemand",
  "holidayCalendar",
  "ruleInstance",
  "ruleSetVersion",
  "configChangeEvent",
  "schedulingPolicy",
  "scheduleCycle",
  "scheduleDraft",
  "scheduleVersion",
  "assignment",
  "scheduleRun",
  "scheduleShareLink",
  "rosterImportBatch",
  "rosterImportCell",
  "auditEvent",
  "payRuleVersion",
] as const;

export type TenantOwnedModel = (typeof TENANT_OWNED_MODELS)[number];

/** where clause ที่บังคับ organizationId */
export function tenantWhere<T extends Record<string, unknown>>(
  ctx: OrganizationContext,
  where?: T,
): T & { organizationId: string } {
  return {
    ...where,
    organizationId: ctx.organizationId,
  } as T & { organizationId: string };
}

/** data ที่ inject organizationId ก่อน create */
export function tenantData<T extends Record<string, unknown>>(
  ctx: OrganizationContext,
  data: T,
): T & { organizationId: string } {
  return {
    ...data,
    organizationId: ctx.organizationId,
  };
}

/** repository ที่ scope ตาม organization — ไม่ใช่ security boundary แต่ลด boilerplate */
export function createScopedRepository(ctx: OrganizationContext, prisma: PrismaClient) {
  const orgId = ctx.organizationId;

  return {
    context: ctx,
    organizationId: orgId,

    department: {
      findMany: (args?: Parameters<PrismaClient["department"]["findMany"]>[0]) =>
        prisma.department.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["department"]["findFirst"]>[0]) =>
        prisma.department.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.DepartmentUncheckedCreateInput>) =>
        prisma.department.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.DepartmentUncheckedUpdateInput }) => {
        const result = await prisma.department.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.department.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
      delete: async (args: { id: string }) => {
        const result = await prisma.department.deleteMany({
          where: { id: args.id, organizationId: orgId },
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
      },
    },

    staffGrade: {
      findMany: (args?: Parameters<PrismaClient["staffGrade"]["findMany"]>[0]) =>
        prisma.staffGrade.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.StaffGradeUncheckedCreateInput>) =>
        prisma.staffGrade.create({ data: tenantData(ctx, data) }),
    },

    staffProfile: {
      findMany: (args?: Parameters<PrismaClient["staffProfile"]["findMany"]>[0]) =>
        prisma.staffProfile.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["staffProfile"]["findFirst"]>[0]) =>
        prisma.staffProfile.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.StaffProfileUncheckedCreateInput>) =>
        prisma.staffProfile.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.StaffProfileUncheckedUpdateInput }) => {
        const result = await prisma.staffProfile.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.staffProfile.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    staffShiftAuthorization: {
      findMany: (args?: Parameters<PrismaClient["staffShiftAuthorization"]["findMany"]>[0]) =>
        prisma.staffShiftAuthorization.findMany({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      findFirst: (args?: Parameters<PrismaClient["staffShiftAuthorization"]["findFirst"]>[0]) =>
        prisma.staffShiftAuthorization.findFirst({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      create: (data: TenantCreateData<Prisma.StaffShiftAuthorizationUncheckedCreateInput>) =>
        prisma.staffShiftAuthorization.create({
          data: tenantData(ctx, data),
        }),
      update: async (args: {
        id: string;
        data: Prisma.StaffShiftAuthorizationUncheckedUpdateInput;
      }) => {
        const result = await prisma.staffShiftAuthorization.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.staffShiftAuthorization.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
      delete: async (args: { id: string }) => {
        const result = await prisma.staffShiftAuthorization.deleteMany({
          where: { id: args.id, organizationId: orgId },
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
      },
    },

    scheduleShareLink: {
      findMany: (args?: Parameters<PrismaClient["scheduleShareLink"]["findMany"]>[0]) =>
        prisma.scheduleShareLink.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["scheduleShareLink"]["findFirst"]>[0]) =>
        prisma.scheduleShareLink.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.ScheduleShareLinkUncheckedCreateInput>) =>
        prisma.scheduleShareLink.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.ScheduleShareLinkUncheckedUpdateInput }) => {
        const result = await prisma.scheduleShareLink.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบลิงก์แชร์ในองค์กร");
        }
        return prisma.scheduleShareLink.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    scheduleCycle: {
      findMany: (args?: Parameters<PrismaClient["scheduleCycle"]["findMany"]>[0]) =>
        prisma.scheduleCycle.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.ScheduleCycleUncheckedCreateInput>) =>
        prisma.scheduleCycle.create({ data: tenantData(ctx, data) }),
    },

    scheduleVersion: {
      findMany: (args?: Parameters<PrismaClient["scheduleVersion"]["findMany"]>[0]) =>
        prisma.scheduleVersion.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["scheduleVersion"]["findFirst"]>[0]) =>
        prisma.scheduleVersion.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.ScheduleVersionUncheckedCreateInput>) =>
        prisma.scheduleVersion.create({ data: tenantData(ctx, data) }),
    },

    assignment: {
      findMany: (args?: Parameters<PrismaClient["assignment"]["findMany"]>[0]) =>
        prisma.assignment.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["assignment"]["findFirst"]>[0]) =>
        prisma.assignment.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.AssignmentUncheckedCreateInput>) =>
        prisma.assignment.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.AssignmentUncheckedUpdateInput }) => {
        const result = await prisma.assignment.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบ assignment ในองค์กร");
        }
        return prisma.assignment.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    auditEvent: {
      findMany: (args?: Parameters<PrismaClient["auditEvent"]["findMany"]>[0]) =>
        prisma.auditEvent.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.AuditEventUncheckedCreateInput>) =>
        prisma.auditEvent.create({ data: tenantData(ctx, data) }),
    },

    configChangeEvent: {
      findMany: (args?: Parameters<PrismaClient["configChangeEvent"]["findMany"]>[0]) =>
        prisma.configChangeEvent.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.ConfigChangeEventUncheckedCreateInput>) =>
        prisma.configChangeEvent.create({ data: tenantData(ctx, data) }),
    },

    shiftCode: {
      findMany: (args?: Parameters<PrismaClient["shiftCode"]["findMany"]>[0]) =>
        prisma.shiftCode.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["shiftCode"]["findFirst"]>[0]) =>
        prisma.shiftCode.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.ShiftCodeUncheckedCreateInput>) =>
        prisma.shiftCode.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.ShiftCodeUncheckedUpdateInput }) => {
        const result = await prisma.shiftCode.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.shiftCode.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    shiftCodeDemand: {
      findMany: (args?: Parameters<PrismaClient["shiftCodeDemand"]["findMany"]>[0]) =>
        prisma.shiftCodeDemand.findMany({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      findFirst: (args?: Parameters<PrismaClient["shiftCodeDemand"]["findFirst"]>[0]) =>
        prisma.shiftCodeDemand.findFirst({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      create: (data: TenantCreateData<Prisma.ShiftCodeDemandUncheckedCreateInput>) =>
        prisma.shiftCodeDemand.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.ShiftCodeDemandUncheckedUpdateInput }) => {
        const result = await prisma.shiftCodeDemand.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.shiftCodeDemand.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
      delete: async (args: { id: string }) => {
        const result = await prisma.shiftCodeDemand.deleteMany({
          where: { id: args.id, organizationId: orgId },
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
      },
    },

    ruleInstance: {
      findMany: (args?: Parameters<PrismaClient["ruleInstance"]["findMany"]>[0]) =>
        prisma.ruleInstance.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      findFirst: (args?: Parameters<PrismaClient["ruleInstance"]["findFirst"]>[0]) =>
        prisma.ruleInstance.findFirst({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.RuleInstanceUncheckedCreateInput>) =>
        prisma.ruleInstance.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.RuleInstanceUncheckedUpdateInput }) => {
        const result = await prisma.ruleInstance.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.ruleInstance.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    payRuleVersion: {
      findMany: (args?: Parameters<PrismaClient["payRuleVersion"]["findMany"]>[0]) =>
        prisma.payRuleVersion.findMany({ ...args, where: tenantWhere(ctx, args?.where) }),
      create: (data: TenantCreateData<Prisma.PayRuleVersionUncheckedCreateInput>) =>
        prisma.payRuleVersion.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.PayRuleVersionUncheckedUpdateInput }) => {
        const result = await prisma.payRuleVersion.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.payRuleVersion.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    rosterImportBatch: {
      findMany: (args?: Parameters<PrismaClient["rosterImportBatch"]["findMany"]>[0]) =>
        prisma.rosterImportBatch.findMany({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      findFirst: (args?: Parameters<PrismaClient["rosterImportBatch"]["findFirst"]>[0]) =>
        prisma.rosterImportBatch.findFirst({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      create: (data: TenantCreateData<Prisma.RosterImportBatchUncheckedCreateInput>) =>
        prisma.rosterImportBatch.create({ data: tenantData(ctx, data) }),
      update: async (args: { id: string; data: Prisma.RosterImportBatchUncheckedUpdateInput }) => {
        const result = await prisma.rosterImportBatch.updateMany({
          where: { id: args.id, organizationId: orgId },
          data: args.data,
        });
        if (result.count === 0) {
          throw new Error("ไม่พบข้อมูลในองค์กร");
        }
        return prisma.rosterImportBatch.findFirstOrThrow({
          where: { id: args.id, organizationId: orgId },
        });
      },
    },

    rosterImportCell: {
      findMany: (args?: Parameters<PrismaClient["rosterImportCell"]["findMany"]>[0]) =>
        prisma.rosterImportCell.findMany({
          ...args,
          where: tenantWhere(ctx, args?.where),
        }),
      createMany: (
        data: readonly TenantCreateData<Prisma.RosterImportCellUncheckedCreateInput>[],
      ) =>
        prisma.rosterImportCell.createMany({
          data: data.map((row) => tenantData(ctx, row)),
        }),
      updateMany: async (args: {
        where: Omit<Prisma.RosterImportCellWhereInput, "organizationId">;
        data: Prisma.RosterImportCellUncheckedUpdateInput;
      }) =>
        prisma.rosterImportCell.updateMany({
          where: { ...args.where, organizationId: orgId },
          data: args.data,
        }),
    },
  } as const;
}

export type ScopedRepository = ReturnType<typeof createScopedRepository>;
