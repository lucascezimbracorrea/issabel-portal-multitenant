import type { Node, Edge } from '@xyflow/react';
import type { DtmfActionRow } from '@/shared/lib/routing-types';

export type UraNodeType =
  | 'start'
  | 'playAudio'
  | 'menuDtmf'
  | 'extension'
  | 'queue'
  | 'ura'
  | 'aiAgent'
  | 'hangup'
  | 'schedule';

export type UraNodeData = {
  label: string;
  nodeType: UraNodeType;
  audioId?: number | null;
  audioName?: string | null;
  extensionNumber?: string | null;
  queueId?: number | null;
  queueName?: string | null;
  uraId?: number | null;
  uraName?: string | null;
  aiAgentId?: number | null;
  aiAgentName?: string | null;
  voiceAgentId?: string | null;
  digit?: string | null;
  scheduleEnabled?: boolean;
  description?: string | null;
};

export type UraNode = Node<UraNodeData>;
export type UraEdge = Edge;

export type UraGraph = {
  nodes: UraNode[];
  edges: UraEdge[];
};

export const NODE_TYPE_META: Record<UraNodeType, { label: string; color: string; bgColor: string; borderColor: string }> = {
  start: {
    label: 'Início',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-400 dark:border-emerald-600',
  },
  playAudio: {
    label: 'Reproduzir Áudio',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-400 dark:border-blue-600',
  },
  menuDtmf: {
    label: 'Menu DTMF',
    color: 'text-violet-700 dark:text-violet-300',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    borderColor: 'border-violet-400 dark:border-violet-600',
  },
  extension: {
    label: 'Ramal',
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-400 dark:border-teal-600',
  },
  queue: {
    label: 'Fila',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-400 dark:border-amber-600',
  },
  ura: {
    label: 'URA',
    color: 'text-rose-700 dark:text-rose-300',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-400 dark:border-rose-600',
  },
  aiAgent: {
    label: 'Agente IA',
    color: 'text-fuchsia-700 dark:text-fuchsia-300',
    bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    borderColor: 'border-fuchsia-400 dark:border-fuchsia-600',
  },
  hangup: {
    label: 'Desligar',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-red-400 dark:border-red-600',
  },
  schedule: {
    label: 'Agenda',
    color: 'text-sky-700 dark:text-sky-300',
    bgColor: 'bg-sky-50 dark:bg-sky-950/40',
    borderColor: 'border-sky-400 dark:border-sky-600',
  },
};

export const PALETTE_NODES: UraNodeType[] = [
  'playAudio',
  'menuDtmf',
  'extension',
  'queue',
  'ura',
  'aiAgent',
  'hangup',
  'schedule',
];

let nodeCounter = 1;

export function createNode(type: UraNodeType, position: { x: number; y: number }): UraNode {
  const meta = NODE_TYPE_META[type];
  return {
    id: `node-${Date.now()}-${nodeCounter++}`,
    type: 'uraNode',
    position,
    data: {
      label: meta.label,
      nodeType: type,
    },
  };
}

export function buildInitialGraph(dtmfActions: DtmfActionRow[]): UraGraph {
  const nodes: UraNode[] = [];
  const edges: UraEdge[] = [];

  const startNode: UraNode = {
    id: 'start',
    type: 'uraNode',
    position: { x: 250, y: 50 },
    data: { label: 'Início', nodeType: 'start' },
  };
  nodes.push(startNode);

  const menuNode: UraNode = {
    id: 'menu',
    type: 'uraNode',
    position: { x: 250, y: 180 },
    data: { label: 'Menu DTMF', nodeType: 'menuDtmf' },
  };
  nodes.push(menuNode);

  edges.push({ id: 'e-start-menu', source: 'start', target: 'menu' });

  const actionNodes = dtmfActions.filter((row) => row.action !== 'none');
  actionNodes.forEach((row, i) => {
    const col = i % 5;
    const row2 = Math.floor(i / 5);
    const x = 50 + col * 200;
    const y = 350 + row2 * 120;

    let nodeType: UraNodeType = 'hangup';
    if (row.action === 'extension') nodeType = 'extension';
    else if (row.action === 'queue') nodeType = 'queue';
    else if (row.action === 'ura') nodeType = 'ura';
    else if (row.action === 'hangup') nodeType = 'hangup';

    const meta = NODE_TYPE_META[nodeType];
    const actionNode: UraNode = {
      id: `dtmf-${row.digit}`,
      type: 'uraNode',
      position: { x, y },
      data: {
        label: `${meta.label} (${row.digit})`,
        nodeType,
        digit: row.digit,
      },
    };
    nodes.push(actionNode);
    edges.push({ id: `e-menu-${row.digit}`, source: 'menu', target: actionNode.id, label: row.digit });
  });

  return { nodes, edges };
}
