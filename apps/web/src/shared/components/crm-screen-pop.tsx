import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { normalizePhoneDisplay } from '@/shared/lib/phone-display';
import { Button } from '@/shared/ui/button';

type Contact = { id: number; name: string; phone: string | null; email: string | null; kind: 'lead' | 'client' };

export function CrmScreenPop({
  orgId,
  phone,
  fromExtension,
}: {
  orgId: number;
  phone: string;
  fromExtension?: string;
}) {
  const digits = phone.replace(/\D/g, '');
  const q = useQuery({
    queryKey: ['crm-pop', orgId, digits],
    queryFn: () =>
      apiFetch<{ leads: Contact[]; clients: Contact[] }>(
        `/organizations/${orgId}/crm/contacts?q=${encodeURIComponent(digits.length >= 8 ? digits : phone)}`,
      ),
    enabled: digits.length >= 8 || phone.trim().length >= 3,
    staleTime: 60_000,
  });

  const dial = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; detail?: string }>(`/organizations/${orgId}/telephony/click-to-call`, {
        method: 'POST',
        body: JSON.stringify({
          fromExtension: fromExtension ?? '',
          toNumber: digits.length >= 8 ? digits : phone,
        }),
      }),
    onSuccess: (r) => {
      if (r.ok) toast.success('Chamada iniciada no PBX');
      else toast.error(r.detail ?? 'Falha ao discar');
    },
    onError: () => toast.error('Click-to-call indisponível (configure AMI)'),
  });

  if (!q.data) return null;
  const items = [...q.data.leads, ...q.data.clients];
  if (items.length === 0) return null;

  const targetPhone = items[0]?.phone ?? phone;

  return (
    <div className="mt-1 rounded-md border border-teal-500/30 bg-teal-500/5 px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 font-medium text-teal-800 dark:text-teal-200">
          <User className="h-3 w-3" />
          LensLead
        </div>
        {fromExtension && targetPhone && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-[10px]"
            disabled={dial.isPending}
            onClick={() => dial.mutate()}
          >
            <Phone className="h-3 w-3" />
            Discar
          </Button>
        )}
      </div>
      {items.slice(0, 2).map((c) => (
        <div key={`${c.kind}-${c.id}`} className="text-muted-foreground">
          {c.kind === 'lead' ? 'Lead' : 'Cliente'}: {c.name}
          {c.phone && ` · ${normalizePhoneDisplay(c.phone)}`}
        </div>
      ))}
    </div>
  );
}
