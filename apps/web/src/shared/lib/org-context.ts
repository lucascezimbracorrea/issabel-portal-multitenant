import { useUiStore } from '@/shared/stores/ui-store';
import type { Me } from '@/shared/types/me';

export function useActiveOrganizationId(me: Me): number | null {
  const selected = useUiStore((s) => s.selectedOrganizationId);
  if (me.role === 'platform_admin') {
    return selected ?? me.organizationIds[0] ?? null;
  }
  return me.organizationIds[0] ?? null;
}
