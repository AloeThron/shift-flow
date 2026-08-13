export { ForbiddenError, hasPermission, requirePermission } from "@/domain/rbac/check-permission";
export {
  PERMISSIONS,
  type Permission,
  permissionsForRole,
  roleHasPermission,
} from "@/domain/rbac/permissions";
