import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { BedDouble, LogIn, LogOut, Plus, Upload } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Property = { id: number; name: string };
type Room = {
  id: number;
  roomNumber: string;
  extensionNumber: string;
  status: 'vacant' | 'occupied' | 'maintenance';
  floor: string | null;
  activeStay: { id: number; guestName: string; passwordHint: string | null } | null;
};

type Provision = {
  host: string;
  port: number;
  username: string;
  password: string;
  displayName: string;
  useTls: boolean;
  wssUrl: string;
  deepLink?: string;
};

const STATUS_STYLE: Record<string, string> = {
  vacant: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  occupied: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  maintenance: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function HospitalityRoomsPage() {
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const qc = useQueryClient();
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propName, setPropName] = useState('');
  const [propHotelId, setPropHotelId] = useState('');
  const [propIpbx, setPropIpbx] = useState('');
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [extNumber, setExtNumber] = useState('');
  const [checkinRoomId, setCheckinRoomId] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');
  const [plannedCheckOut, setPlannedCheckOut] = useState('');
  const [provision, setProvision] = useState<Provision | null>(null);
  const [stayId, setStayId] = useState<number | null>(null);

  const properties = useQuery({
    queryKey: ['hotel-properties', orgId],
    queryFn: () =>
      apiFetch<{ items: { id: number; name: string }[] }>(
        `/organizations/${orgId}/hospitality/properties`,
      ),
    enabled: !!orgId,
  });

  const rooms = useQuery({
    queryKey: ['hotel-rooms', orgId],
    queryFn: () =>
      apiFetch<{ properties: Property[]; items: Room[] }>(`/organizations/${orgId}/hospitality/rooms`),
    enabled: !!orgId,
  });

  const logs = useQuery({
    queryKey: ['hotel-logs', orgId],
    queryFn: () =>
      apiFetch<{ items: { id: number; type: string; metadataJson: string; createdAt: string }[] }>(
        `/organizations/${orgId}/hospitality/logs`,
      ),
    enabled: !!orgId,
  });

  const activePropertyId = properties.data?.items?.[0]?.id ?? rooms.data?.properties?.[0]?.id ?? null;

  const createProperty = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${orgId}/hospitality/properties`, {
        method: 'POST',
        body: JSON.stringify({
          name: propName,
          externalHotelId: propHotelId,
          ipbxUrl: propIpbx,
        }),
      }),
    onSuccess: () => {
      toast.success('Propriedade criada');
      setShowPropertyForm(false);
      void qc.invalidateQueries({ queryKey: ['hotel-properties', orgId] });
    },
    onError: () => toast.error('Erro ao criar propriedade'),
  });

  const createRoom = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${orgId}/hospitality/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          propertyId: activePropertyId,
          roomNumber,
          extensionNumber: extNumber,
        }),
      }),
    onSuccess: () => {
      toast.success('Quarto criado');
      setShowRoomForm(false);
      setRoomNumber('');
      setExtNumber('');
      void qc.invalidateQueries({ queryKey: ['hotel-rooms', orgId] });
    },
    onError: () => toast.error('Erro ao criar quarto'),
  });

  const checkIn = useMutation({
    mutationFn: (roomId: number) =>
      apiFetch<{ stay: { id: number }; provision: Provision | null }>(
        `/organizations/${orgId}/hospitality/rooms/${roomId}/check-in`,
        {
          method: 'POST',
          body: JSON.stringify({
            guestName,
            plannedCheckOut: plannedCheckOut ? new Date(plannedCheckOut).toISOString() : undefined,
          }),
        },
      ),
    onSuccess: (data) => {
      toast.success('Check-in iniciado');
      setCheckinRoomId(null);
      setGuestName('');
      if (data.provision) {
        setProvision(data.provision);
        setStayId(data.stay.id);
      }
      void qc.invalidateQueries({ queryKey: ['hotel-rooms', orgId] });
    },
    onError: () => toast.error('Erro no check-in'),
  });

  const checkOut = useMutation({
    mutationFn: (roomId: number) =>
      apiFetch(`/organizations/${orgId}/hospitality/rooms/${roomId}/check-out`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Check-out concluído');
      setProvision(null);
      setStayId(null);
      void qc.invalidateQueries({ queryKey: ['hotel-rooms', orgId] });
    },
    onError: () => toast.error('Erro no check-out'),
  });

  const importCsv = useMutation({
    mutationFn: (rows: { roomNumber: string; extensionNumber: string }[]) =>
      apiFetch<{ created: number }>(`/organizations/${orgId}/hospitality/rooms/import`, {
        method: 'POST',
        body: JSON.stringify({ propertyId: activePropertyId, rows }),
      }),
    onSuccess: (r: { created: number }) => {
      toast.success(`${r.created} quartos importados`);
      void qc.invalidateQueries({ queryKey: ['hotel-rooms', orgId] });
    },
    onError: () => toast.error('Erro na importação'),
  });

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const rows = lines
        .slice(1)
        .map((line) => {
          const [rn, en] = line.split(/[,;]/).map((s) => s.trim());
          return { roomNumber: rn, extensionNumber: en };
        })
        .filter((r) => r.roomNumber && r.extensionNumber);
      if (rows.length === 0) {
        toast.error('CSV inválido (cabeçalho: quarto,ramal)');
        return;
      }
      importCsv.mutate(rows);
    };
    reader.readAsText(file);
  }

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">Selecione uma organização.</p>;
  }

  if (properties.isLoading || rooms.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const items = rooms.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BedDouble className="h-7 w-7 text-teal-600" />
            Hotelaria — Quartos
          </h1>
          <p className="text-sm text-muted-foreground">Inventário, ramais e check-in/out via ramal cloud.</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPropertyForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Propriedade
            </Button>
            <Button size="sm" onClick={() => setShowRoomForm(true)} disabled={!activePropertyId}>
              <Plus className="mr-1 h-4 w-4" />
              Quarto
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium">
                <Upload className="mr-1 h-4 w-4" />
                CSV
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={!activePropertyId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCsvFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}
      </div>

      {showPropertyForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nova propriedade</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Nome do hotel" value={propName} onChange={(e) => setPropName(e.target.value)} />
            <Input placeholder="hotel_id" value={propHotelId} onChange={(e) => setPropHotelId(e.target.value)} />
            <Input placeholder="https://pbx.exemplo.com" value={propIpbx} onChange={(e) => setPropIpbx(e.target.value)} />
            <Button onClick={() => createProperty.mutate()} disabled={createProperty.isPending}>Salvar</Button>
          </CardContent>
        </Card>
      )}

      {showRoomForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Novo quarto</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Nº quarto" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
            <Input placeholder="Ramal SIP" value={extNumber} onChange={(e) => setExtNumber(e.target.value)} />
            <Button onClick={() => createRoom.mutate()} disabled={createRoom.isPending}>Salvar</Button>
          </CardContent>
        </Card>
      )}

      {provision && (
        <Card className="border-teal-500/50">
          <CardHeader><CardTitle className="text-base">Credenciais SIP (hóspede)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Ramal <strong>{provision.username}</strong> — {provision.displayName}
            </p>
            <div className="flex flex-wrap gap-4 items-start">
              <img
                alt="QR provision"
                className="rounded border bg-white p-2"
                width={200}
                height={200}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify(provision))}`}
              />
              <div className="text-xs font-mono space-y-1 break-all max-w-md">
                <div>Host: {provision.host}</div>
                <div>WSS: {provision.wssUrl}</div>
                {provision.deepLink && (
                  <a href={provision.deepLink} className="text-teal-600 underline block mt-2">
                    Abrir no softphone
                  </a>
                )}
                {stayId && orgId && (
                  <p className="text-muted-foreground mt-1">
                    Use o endpoint GET /organizations/{orgId}/softphone/provision?stayId={stayId}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((room) => (
          <Card key={room.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">Quarto {room.roomNumber}</CardTitle>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', STATUS_STYLE[room.status])}>
                  {room.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Ramal {room.extensionNumber}</p>
              {room.activeStay && <p className="text-sm mt-1">Hóspede: {room.activeStay.guestName}</p>}
            </CardHeader>
            <CardContent className="flex gap-2">
              {canWrite && room.status !== 'occupied' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCheckinRoomId(room.id);
                    setGuestName('');
                  }}
                >
                  <LogIn className="h-4 w-4 mr-1" />
                  Check-in
                </Button>
              )}
              {canWrite && room.status === 'occupied' && (
                <Button size="sm" variant="outline" onClick={() => checkOut.mutate(room.id)}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Check-out
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {checkinRoomId !== null && (
        <Card>
          <CardContent className="pt-6 flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Nome do hóspede</label>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Check-out previsto (auto)</label>
              <Input
                type="datetime-local"
                value={plannedCheckOut}
                onChange={(e) => setPlannedCheckOut(e.target.value)}
              />
            </div>
            <Button onClick={() => checkIn.mutate(checkinRoomId)} disabled={!guestName.trim() || checkIn.isPending}>
              Confirmar check-in
            </Button>
            <Button variant="ghost" onClick={() => setCheckinRoomId(null)}>Cancelar</Button>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Nenhum quarto cadastrado.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico recente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-48 overflow-y-auto text-xs">
          {(logs.data?.items ?? []).map((log) => (
            <div key={log.id} className="border-b border-border/50 pb-1">
              <span className="font-medium">{log.type}</span>
              <span className="text-muted-foreground ml-2">{log.createdAt}</span>
            </div>
          ))}
          {logs.data?.items?.length === 0 && (
            <p className="text-muted-foreground">Sem eventos ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
