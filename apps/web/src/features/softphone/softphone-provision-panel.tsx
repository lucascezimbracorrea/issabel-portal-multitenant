import { useQuery } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

type Provision = {
  host: string;
  port: number;
  username: string;
  password: string | null;
  displayName: string;
  useTls: boolean;
  wssUrl: string;
  pushRegisterUrl?: string;
  deepLink?: string;
  warning?: string;
};

export function SoftphoneProvisionPanel({
  orgId,
  extensionId,
  stayId,
}: {
  orgId: number;
  extensionId?: number;
  stayId?: number;
}) {
  const q = extensionId
    ? `extensionId=${extensionId}`
    : stayId
      ? `stayId=${stayId}`
      : null;

  const provision = useQuery({
    queryKey: ['softphone-provision', orgId, q],
    queryFn: () => apiFetch<Provision>(`/organizations/${orgId}/softphone/provision?${q}`),
    enabled: !!q,
  });

  if (!q) return null;
  if (provision.isLoading) return <Skeleton className="h-32 w-full" />;
  if (provision.isError || !provision.data) return null;

  const data = provision.data;
  if (!data.password) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-amber-700">
          {data.warning ?? 'Senha SIP não disponível no portal. Configure metadata.sipSecret no ramal.'}
        </CardContent>
      </Card>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(JSON.stringify(data))}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Provisionar softphone
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-4 items-start">
        <img src={qrUrl} alt="QR SIP" width={220} height={220} className="rounded border bg-white p-2" />
        <div className="space-y-2 text-sm">
          <p>
            <strong>{data.displayName}</strong> — ramal {data.username}@{data.host}
          </p>
          {data.deepLink && (
            <Button asChild size="sm">
              <a href={data.deepLink}>Abrir no app</a>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            }}
          >
            Copiar JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
