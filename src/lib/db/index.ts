export { recordAuditEvent, recordConfigChange } from "@/lib/db/audit";
export type { AuditEventInput, ConfigChangeInput } from "@/lib/db/audit";
export {
  createScopedRepository,
  TENANT_OWNED_MODELS,
  tenantData,
  tenantWhere,
  type ScopedRepository,
  type TenantOwnedModel,
} from "@/lib/db/scoped-repository";
