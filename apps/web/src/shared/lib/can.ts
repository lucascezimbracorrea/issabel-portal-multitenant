export type Role = 'platform_admin' | 'org_admin' | 'org_operator' | 'org_viewer';

export function canViewPath(_role: Role, _path: string): boolean {
  return true;
}

export function canAccessDiagnostics(role: Role): boolean {
  return role === 'platform_admin';
}

export function canManageOrgAppearance(role: Role): boolean {
  return role === 'platform_admin' || role === 'org_admin';
}

export function canManageOrgDomain(role: Role): boolean {
  return role === 'platform_admin' || role === 'org_admin';
}

export function canCreateWebhooks(role: Role): boolean {
  return role === 'platform_admin' || role === 'org_admin' || role === 'org_operator';
}

/** Create/update/delete extensions (ramais) in the portal. */
export function canWriteExtensions(role: Role): boolean {
  return role === 'platform_admin' || role === 'org_admin' || role === 'org_operator';
}

/** Create/update/delete spaces (tenant structure). */
export function canManageSpaces(role: Role): boolean {
  return role === 'platform_admin' || role === 'org_admin';
}

export function canWriteCallFlows(role: Role): boolean {
  return canWriteExtensions(role);
}
