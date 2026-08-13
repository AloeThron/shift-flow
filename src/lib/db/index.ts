export type { AuditEventInput, ConfigChangeInput } from "@/lib/db/audit";
export { recordAuditEvent, recordConfigChange } from "@/lib/db/audit";
export {
  createScopedRepository,
  type ScopedRepository,
  TENANT_OWNED_MODELS,
  type TenantOwnedModel,
  tenantData,
  tenantWhere,
} from "@/lib/db/scoped-repository";
