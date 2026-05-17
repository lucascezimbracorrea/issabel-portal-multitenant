import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applyAppearanceCssVars, clearBrandingCssVars } from '@/shared/lib/branding-css';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import type { Me } from '@/shared/types/me';
import { useActiveOrganizationId } from '@/shared/lib/org-context';

/**
 * Applies organization + host branding as CSS variables on the document root.
 */
export function BrandingProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const activeOrgId = useActiveOrganizationId(me);

  const hostBranding = useQuery({
    queryKey: qk.brandingHost(host),
    queryFn: () =>
      apiFetch<{ organizationId: number | null; tradeName?: string; appearance: Record<string, unknown> }>(
        `/public/branding-by-host?host=${encodeURIComponent(host)}`,
      ),
    staleTime: 60_000,
  });

  const org = useQuery({
    queryKey: qk.organization(activeOrgId ?? 0),
    queryFn: () =>
      apiFetch<{ appearance?: Record<string, unknown>; issabelBaseUrl?: string | null }>(`/organizations/${activeOrgId}`),
    enabled: !!activeOrgId,
    staleTime: 30_000,
  });

  useEffect(() => {
    const hostAppearance = (hostBranding.data?.appearance ?? {}) as Record<string, unknown>;
    const orgAppearance = (org.data?.appearance ?? {}) as Record<string, unknown>;
    const merged = { ...hostAppearance, ...orgAppearance };
    if (Object.keys(merged).length === 0) {
      clearBrandingCssVars();
      return;
    }
    applyAppearanceCssVars(merged);
    return () => {
      clearBrandingCssVars();
    };
  }, [hostBranding.data, org.data]);

  return children;
}
