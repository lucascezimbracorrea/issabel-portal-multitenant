import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Mic, PhoneOff, Hash, Phone, List, Calendar, Play as PlayIcon, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { UraNode, UraNodeType } from '../ura-node-types';
import { NODE_TYPE_META } from '../ura-node-types';

const NODE_ICONS: Record<UraNodeType, React.FC<{ className?: string }>> = {
  start: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10,8 16,12 10,16" fill="white" />
    </svg>
  ),
  playAudio: ({ className }) => <PlayIcon className={className} />,
  menuDtmf: ({ className }) => <Hash className={className} />,
  extension: ({ className }) => <Phone className={className} />,
  queue: ({ className }) => <List className={className} />,
  ura: ({ className }) => <Mic className={className} />,
  aiAgent: ({ className }) => <Sparkles className={className} />,
  hangup: ({ className }) => <PhoneOff className={className} />,
  schedule: ({ className }) => <Calendar className={className} />,
};

export function UraBaseNode({ data, selected }: NodeProps<UraNode>) {
  const meta = NODE_TYPE_META[data.nodeType];
  const Icon = NODE_ICONS[data.nodeType];
  const isStart = data.nodeType === 'start';
  const isTerminal = data.nodeType === 'hangup';

  return (
    <div
      className={cn(
        'min-w-[140px] max-w-[200px] rounded-xl border-2 shadow-md transition-all',
        meta.bgColor,
        meta.borderColor,
        selected && 'ring-2 ring-offset-1 ring-blue-500',
      )}
    >
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-slate-400"
        />
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', meta.bgColor)}>
          <Icon className={cn('h-4 w-4', meta.color)} />
        </div>
        <div className="min-w-0">
          <p className={cn('text-xs font-semibold leading-tight truncate', meta.color)}>{data.label}</p>
          {data.digit && (
            <p className="text-[10px] text-muted-foreground">Dígito: {data.digit}</p>
          )}
          {data.aiAgentName && (
            <p className="text-[10px] text-muted-foreground truncate">{data.aiAgentName}</p>
          )}
          {data.description && (
            <p className="text-[10px] text-muted-foreground truncate">{data.description}</p>
          )}
        </div>
      </div>

      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-slate-400"
        />
      )}
    </div>
  );
}
