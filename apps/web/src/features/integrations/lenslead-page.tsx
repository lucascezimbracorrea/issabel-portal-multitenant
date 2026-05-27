import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { RefreshCw, Users } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

type LensleadStatus = {
  configured: boolean;
  enabled?: boolean;
  status?: string;
  lensleadUserId?: string;
  functionsUrl?: string;
  lastSyncedAt?: string | null;
};

export function LensleadPage() {
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const qc = useQueryClient();
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin';

  const [userId, setUserId] = useState('');
  const [functionsUrl, setFunctionsUrl] = useState('');
  const [syncSecret, setSyncSecret] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const status = useQuery({
    queryKey: ['lenslead', orgId],
    queryFn: () => apiFetch<LensleadStatus>(`/organizations/${orgId}/integrations/lenslead`),
    enabled: !!orgId,
  });

  const contacts = useQuery({
    queryKey: ['crm-contacts', orgId, searchQ],
    queryFn: () =>
      apiFetch<{
        leads: { id: number; name: string; phone: string | null; email: string | null; kind: 'lead' }[];
        clients: { id: number; name: string; phone: string | null; email: string | null; kind: 'client' }[];
      }>(`/organizations/${orgId}/crm/contacts?q=${encodeURIComponent(searchQ)}`),
    enabled: !!orgId && searchQ.length >= 2,
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${orgId}/integrations/lenslead`, {
        method: 'PUT',
        body: JSON.stringify({
          lensleadUserId: userId,
          functionsUrl: functionsUrl || undefined,
          syncSecret: syncSecret || undefined,
          enabled: true,
        }),
      }),
    onSuccess: () => {
      toast.success('LensLead configurado');
      void qc.invalidateQueries({ queryKey: ['lenslead', orgId] });
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const syncNow = useMutation({
    mutationFn: () =>
      apiFetch<{ leads: number; clients: number }>(`/organizations/${orgId}/integrations/lenslead/sync`, {
        method: 'POST',
      }),
    onSuccess: (r) => {
      toast.success(`Sync: ${r.leads} leads, ${r.clients} clientes`);
      void qc.invalidateQueries({ queryKey: ['lenslead', orgId] });
    },
    onError: () => toast.error('Falha na sincronização'),
  });

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">Selecione uma organização.</p>;
  }

  if (status.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          LensLead Pro
        </h1>
        <p className="text-sm text-muted-foreground">
          Sincronização via cron (15 min) + sync manual. Mapeie o UUID do usuário LensLead.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.data?.configured && (
            <p className="text-sm text-muted-foreground">
              Último sync: {status.data.lastSyncedAt ?? 'nunca'} — status {status.data.status}
            </p>
          )}
          <Input
            placeholder="LensLead user_id (UUID)"
            value={userId || status.data?.lensleadUserId || ''}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!canWrite}
          />
          <Input
            placeholder="Functions URL (opcional)"
            value={functionsUrl || status.data?.functionsUrl || ''}
            onChange={(e) => setFunctionsUrl(e.target.value)}
            disabled={!canWrite}
          />
          <Input
            type="password"
            placeholder="PORTAL_SYNC_SECRET"
            value={syncSecret}
            onChange={(e) => setSyncSecret(e.target.value)}
            disabled={!canWrite}
          />
          {canWrite && (
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                Salvar
              </Button>
              <Button variant="outline" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Sincronizar agora
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar contactos (screen-pop)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Nome ou telefone (mín. 2 caracteres)"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          {contacts.isFetching && <Skeleton className="h-20" />}
          {contacts.data && (
            <ul className="text-sm space-y-2">
              {contacts.data.leads.map((l) => (
                <li key={`l-${l.id}`} className="rounded border p-2">
                  <span className="text-xs uppercase text-muted-foreground">Lead</span> — {l.name}{' '}
                  {l.phone && <span className="text-muted-foreground">({l.phone})</span>}
                </li>
              ))}
              {contacts.data.clients.map((c) => (
                <li key={`c-${c.id}`} className="rounded border p-2">
                  <span className="text-xs uppercase text-muted-foreground">Cliente</span> — {c.name}{' '}
                  {c.phone && <span className="text-muted-foreground">({c.phone})</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
