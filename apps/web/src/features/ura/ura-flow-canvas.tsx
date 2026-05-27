import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { UraGraph, UraNode, UraEdge } from './ura-node-types';
import { UraBaseNode } from './nodes/ura-base-node';

const nodeTypes: NodeTypes = {
  uraNode: UraBaseNode,
};

type Props = {
  initialGraph: UraGraph;
  onGraphChange: (graph: UraGraph) => void;
};

export function UraFlowCanvas({ initialGraph, onGraphChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<UraNode>(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<UraEdge>(initialGraph.edges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(connection, eds);
        onGraphChange({ nodes, edges: next });
        return next;
      });
    },
    [nodes, onGraphChange, setEdges],
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      setNodes((nds) => {
        onGraphChange({ nodes: nds, edges });
        return nds;
      });
    },
    [edges, onGraphChange, onNodesChange, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setEdges((eds) => {
        onGraphChange({ nodes, edges: eds });
        return eds;
      });
    },
    [nodes, onGraphChange, onEdgesChange, setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      className="bg-muted/20 dark:bg-slate-950"
    >
      <Controls className="!shadow-md" />
      <MiniMap
        nodeColor={(node) => {
          const n = node as UraNode;
          const colorMap: Record<string, string> = {
            start: '#10b981',
            playAudio: '#3b82f6',
            menuDtmf: '#8b5cf6',
            extension: '#14b8a6',
            queue: '#f59e0b',
            ura: '#f43f5e',
            hangup: '#ef4444',
            schedule: '#0ea5e9',
          };
          return colorMap[n.data?.nodeType ?? ''] ?? '#94a3b8';
        }}
        className="!border !border-border !rounded-lg !shadow-md"
      />
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-40" />
    </ReactFlow>
  );
}
