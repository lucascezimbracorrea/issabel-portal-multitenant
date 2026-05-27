import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Save, ArrowLeft, Plus } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { UraFlowCanvas } from '@/features/ura/ura-flow-canvas';
import type { UraGraph, UraNodeType } from '@/features/ura/ura-node-types';
import { PALETTE_NODES, NODE_TYPE_META, createNode, buildInitialGraph } from '@/features/ura/ura-node-types';

type UraDetail = {
  id: number;
  name: string;
  graphJson: string;
  dtmfActionsJson: string;
};

const DEBOUNCE_MS = 2000;

export function CallFlowFlowEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const params = useParams({ strict: false }) as { flowId?: string };
  const flowId = params.flowId ? Number(params.flowId) : null;

  const [graph, setGraph] = useState<UraGraph>({ nodes: [], edges: [] });
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: flow, isPending } = useQuery({
    queryKey: ['call-flow', flowId ?? 0],
    queryFn: () => apiFetch<UraDetail>(`/call-flows/${flowId}`),
    enabled: !!flowId,
  });

  useEffect(() => {
    if (flow) {
      try {
        const parsed: UraGraph = JSON.parse(flow.graphJson ?? '{"nodes":[],"edges":[]}');
        if (parsed.nodes.length === 0) {
          setGraph(buildInitialGraph([]));
        } else {
          setGraph(parsed);
        }
      } catch {
        setGraph({ nodes: [], edges: [] });
      }
    }
  }, [flow]);

  const saveMutation = useMutation({
    mutationFn: (g: UraGraph) =>
      apiFetch(`/call-flows/${flowId}`, {
        method: 'PATCH',
        body: JSON.stringify({ graphJson: JSON.stringify(g) }),
      }),
    onSuccess: async () => {
      toast.success(t('ura.graphSaved'));
      setHasUnsaved(false);
      await qc.invalidateQueries({ queryKey: ['call-flow', flowId ?? 0] });
    },
    onError: () => toast.error(t('ura.graphFailed')),
  });

  const handleGraphChange = useCallback(
    (g: UraGraph) => {
      setGraph(g);
      setHasUnsaved(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate(g);
      }, DEBOUNCE_MS);
    },
    [saveMutation],
  );

  function handleManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveMutation.mutate(graph);
  }

  function handleAddNode(type: UraNodeType) {
    const position = {
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
    };
    const newNode = createNode(type, position);
    const newGraph: UraGraph = {
      nodes: [...graph.nodes, newNode],
      edges: graph.edges,
    };
    handleGraphChange(newGraph);
  }

  if (!flowId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t('ura.noIdSelected')}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigate({ to: '/pbx/features/call-flows' })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('ura.backToForm')}
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">
            {isPending ? '…' : (flow?.name ?? t('ura.editFallback'))}
          </span>
          {hasUnsaved && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {t('ura.unsaved')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={handleManualSave}
            disabled={saveMutation.isPending || !hasUnsaved}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? t('extensions.form.saving') : t('actions.save')}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/30 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t('ura.palette')}
          </p>
          {PALETTE_NODES.map((type) => {
            const meta = NODE_TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleAddNode(type)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-xs font-medium transition-all hover:shadow-sm',
                  meta.bgColor,
                  meta.borderColor,
                  meta.color,
                )}
              >
                <Plus className="h-3 w-3 shrink-0" />
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1">
          {isPending ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              {t('extensions.form.saving')}…
            </div>
          ) : (
            <UraFlowCanvas initialGraph={graph} onGraphChange={handleGraphChange} />
          )}
        </div>
      </div>
    </div>
  );
}
