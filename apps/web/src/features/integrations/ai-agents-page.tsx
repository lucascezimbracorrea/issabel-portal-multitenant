import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Bot, Plus, Trash2, PhoneIncoming, ShoppingCart, Banknote, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

// ─── Presets ─────────────────────────────────────────────────────────────────

type AgentPreset = {
  id: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  gradient: string;
  name: string;
  tagline: string;
  model: string;
  prompt: string;
};

const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'receptionist',
    icon: PhoneIncoming,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-100 dark:bg-sky-950/40',
    gradient: 'from-sky-500 to-cyan-500',
    name: 'Recepcionista Virtual',
    tagline: 'Atende, direciona e registra mensagens com cordialidade.',
    model: 'gpt-4o-mini',
    prompt:
      'Você é uma recepcionista virtual profissional e simpática da empresa. Seu papel é:\n' +
      '- Recepcionar os clientes de forma calorosa e educada\n' +
      '- Entender o motivo do contato e direcionar para o departamento correto\n' +
      '- Registrar mensagens quando o responsável não estiver disponível\n' +
      '- Informar horários de funcionamento, endereço e contatos gerais\n' +
      '- Manter sempre um tom profissional, claro e acolhedor\n\n' +
      'Nunca invente informações que não tenha. Quando não souber, ofereça-se para encaminhar a solicitação.',
  },
  {
    id: 'salesperson',
    icon: ShoppingCart,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950/40',
    gradient: 'from-emerald-500 to-teal-500',
    name: 'Assistente de Vendas',
    tagline: 'Identifica necessidades, apresenta produtos e guia o cliente na compra.',
    model: 'gpt-4o-mini',
    prompt:
      'Você é um assistente de vendas consultivo e entusiasmado da empresa. Seu papel é:\n' +
      '- Entender as necessidades e o perfil do cliente com perguntas abertas\n' +
      '- Apresentar produtos e serviços relevantes de forma clara e objetiva\n' +
      '- Destacar benefícios e diferenciais, sem exageros\n' +
      '- Responder dúvidas sobre preços, condições de pagamento e prazos\n' +
      '- Guiar o cliente na jornada de compra de forma natural e sem pressão\n' +
      '- Registrar o interesse e oferecer próximos passos (visita, proposta, demonstração)\n\n' +
      'Seja empático, honesto e focado em gerar valor real para o cliente.',
  },
  {
    id: 'collector',
    icon: Banknote,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-950/40',
    gradient: 'from-amber-500 to-orange-500',
    name: 'Assistente de Cobrança',
    tagline: 'Negocia débitos com respeito, registra acordos e oferece opções.',
    model: 'gpt-4o-mini',
    prompt:
      'Você é um assistente de cobrança profissional, respeitoso e empático da empresa. Seu papel é:\n' +
      '- Informar o cliente sobre pendências financeiras de forma clara e discreta\n' +
      '- Ouvir o cliente e entender sua situação antes de propor soluções\n' +
      '- Oferecer opções de pagamento: à vista, parcelamento ou renegociação\n' +
      '- Registrar acordos, datas e valores combinados com precisão\n' +
      '- Manter sempre um tom cordial, sem pressão excessiva ou linguagem ameaçadora\n' +
      '- Escalar para um humano quando necessário (acordos especiais, disputas)\n\n' +
      'Nunca use linguagem constrangedora. O objetivo é resolver, não intimidar.',
  },
];

// ─── Preset Card ─────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: AgentPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = preset.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-violet-500 bg-violet-50 shadow-md dark:bg-violet-950/30'
          : 'border-border bg-card hover:border-violet-300 hover:shadow-sm dark:hover:border-violet-700',
      )}
    >
      {selected && (
        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-violet-500" />
      )}
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', preset.bgColor)}>
        <Icon className={cn('h-5 w-5', preset.color)} />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{preset.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{preset.tagline}</p>
      </div>
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AiAgent = {
  id: number;
  name: string;
  status: string;
  model: string;
  prompt: string;
  createdAt: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AiAgentsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const activeOrg = useActiveOrganizationId(me);
  const orgId = activeOrg ?? me.organizationIds[0] ?? 0;
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentModel, setAgentModel] = useState('gpt-4o-mini');
  const [agentPrompt, setAgentPrompt] = useState('');

  const agents = useQuery({
    queryKey: ['ai-agents', orgId],
    queryFn: () => apiFetch<{ items: AiAgent[] }>(`/ai-agents?organizationId=${orgId}`),
    enabled: orgId > 0,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/ai-agents', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          name: agentName.trim(),
          model: agentModel,
          prompt: agentPrompt.trim(),
          status: 'active',
        }),
      }),
    onSuccess: async () => {
      toast.success(t('aiAgents.created'));
      setShowCreate(false);
      setSelectedPreset(null);
      setAgentName('');
      setAgentPrompt('');
      setAgentModel('gpt-4o-mini');
      await qc.invalidateQueries({ queryKey: ['ai-agents', orgId] });
    },
    onError: () => toast.error(t('aiAgents.createFailed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/ai-agents/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('aiAgents.deleted'));
      await qc.invalidateQueries({ queryKey: ['ai-agents', orgId] });
    },
    onError: () => toast.error(t('aiAgents.deleteFailed')),
  });

  function applyPreset(preset: AgentPreset) {
    setSelectedPreset(preset.id);
    setAgentName(preset.name);
    setAgentModel(preset.model);
    setAgentPrompt(preset.prompt);
    setShowCreate(true);
  }

  function openBlank() {
    setSelectedPreset(null);
    setAgentName('');
    setAgentPrompt('');
    setAgentModel('gpt-4o-mini');
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setSelectedPreset(null);
    setAgentName('');
    setAgentPrompt('');
    setAgentModel('gpt-4o-mini');
  }

  const items = agents.data?.items ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-violet-300 dark:via-purple-300 dark:to-fuchsia-200">
          {t('aiAgents.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('aiAgents.subtitle')}</p>
      </div>

      {orgId === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>
      ) : (
        <div className="space-y-6">
          {/* Action row */}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={showCreate ? closeCreate : openBlank}
            >
              <Plus className="h-4 w-4" />
              {showCreate ? t('actions.cancel') : t('aiAgents.createBtn')}
            </Button>
          </div>

          {/* Create form */}
          {showCreate && (
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
              <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardHeader className="border-b border-border bg-muted/20">
                <CardTitle className="text-base">{t('aiAgents.createTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('aiAgents.presetsHint')}</p>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {/* Preset picker inside form */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {AGENT_PRESETS.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      selected={selectedPreset === preset.id}
                      onSelect={() => applyPreset(preset)}
                    />
                  ))}
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">{t('aiAgents.orCustomize')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">{t('aiAgents.fieldName')}</label>
                    <Input
                      value={agentName}
                      onChange={(e) => { setAgentName(e.target.value); setSelectedPreset(null); }}
                      placeholder={t('aiAgents.fieldNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">{t('aiAgents.fieldModel')}</label>
                    <select
                      value={agentModel}
                      onChange={(e) => setAgentModel(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                      <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t('aiAgents.fieldPrompt')}</label>
                  <textarea
                    value={agentPrompt}
                    onChange={(e) => { setAgentPrompt(e.target.value); setSelectedPreset(null); }}
                    placeholder={t('aiAgents.fieldPromptPlaceholder')}
                    rows={6}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <Button
                  type="button"
                  disabled={create.isPending || !agentName.trim()}
                  onClick={() => create.mutate()}
                  className="gap-2"
                >
                  <Bot className="h-4 w-4" />
                  {create.isPending ? t('aiAgents.creating') : t('aiAgents.createBtn')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Agent list / empty state */}
          {agents.isPending ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : items.length === 0 && !showCreate ? (
            <div className="space-y-8 py-4">
              {/* Hero empty state */}
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-950/30">
                  <Sparkles className="h-8 w-8 text-violet-500" />
                </div>
                <div>
                  <p className="font-semibold">{t('aiAgents.emptyTitle')}</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('aiAgents.emptyBody')}</p>
                </div>
              </div>

              {/* Preset suggestions */}
              <div>
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('aiAgents.suggestionsLabel')}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {AGENT_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-violet-300 hover:shadow-md dark:hover:border-violet-700"
                      >
                        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', preset.bgColor)}>
                          <Icon className={cn('h-6 w-6', preset.color)} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{preset.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{preset.tagline}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-medium text-violet-600 group-hover:underline dark:text-violet-400">
                          <Sparkles className="h-3 w-3" />
                          {t('aiAgents.usePreset')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-center">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openBlank}>
                  <Plus className="h-4 w-4" />
                  {t('aiAgents.createFromScratch')}
                </Button>
              </div>
            </div>
          ) : items.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((agent) => {
                const preset = AGENT_PRESETS.find((p) => p.name === agent.name);
                const Icon = preset?.icon ?? Bot;
                return (
                  <Card key={agent.id} className="overflow-hidden border-0 shadow-md ring-1 ring-border/50">
                    <div className={cn('h-1 bg-gradient-to-r', preset ? preset.gradient : 'from-violet-500 to-purple-500', agent.status !== 'active' && 'opacity-30')} />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', preset?.bgColor ?? 'bg-violet-100 dark:bg-violet-900/30')}>
                            <Icon className={cn('h-4 w-4', preset?.color ?? 'text-violet-600 dark:text-violet-400')} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{agent.name}</p>
                            <p className="text-[10px] text-muted-foreground">{agent.model}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(t('aiAgents.confirmDelete'))) return;
                            remove.mutate(agent.id);
                          }}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardHeader>
                    {agent.prompt && (
                      <CardContent className="text-xs text-muted-foreground">
                        <p className="line-clamp-2">{agent.prompt}</p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
