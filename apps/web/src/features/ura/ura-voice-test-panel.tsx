import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Phone, Volume2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type Props = {
  orgId: number;
  extensionNumber: string;
  initialMessage: string;
  aiInstructions: string;
  useInitialMessage: boolean;
};

export function UraVoiceTestPanel({
  orgId,
  extensionNumber,
  initialMessage,
  aiInstructions,
  useInitialMessage,
}: Props) {
  const { t } = useTranslation();
  const [fromExtension, setFromExtension] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const dial = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; detail?: string }>(`/organizations/${orgId}/telephony/click-to-call`, {
        method: 'POST',
        body: JSON.stringify({
          fromExtension: fromExtension.trim(),
          toNumber: extensionNumber.trim(),
        }),
      }),
    onSuccess: (r) => {
      if (r.ok) toast.success(t('routing.ura.voiceTestCallStarted'));
      else toast.error(r.detail ?? t('routing.ura.voiceTestCallFailed'));
    },
    onError: () => toast.error(t('routing.ura.voiceTestCallFailed')),
  });

  function previewText(): string {
    if (useInitialMessage && initialMessage.trim()) return initialMessage.trim();
    if (aiInstructions.trim()) {
      const snippet = aiInstructions.trim().slice(0, 280);
      return snippet.length < aiInstructions.trim().length ? `${snippet}…` : snippet;
    }
    return t('routing.ura.voiceTestDefaultMessage');
  }

  function handleSpeak() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error(t('routing.ura.voiceTestUnsupported'));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(previewText());
    utterance.lang = 'pt-BR';
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      toast.error(t('routing.ura.voiceTestSpeakFailed'));
    };
    window.speechSynthesis.speak(utterance);
  }

  function handleStop() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <p className="text-sm font-medium text-violet-900 dark:text-violet-100">{t('routing.ura.voiceTestTitle')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('routing.ura.voiceTestHint')}</p>
      <p className="mt-3 line-clamp-3 rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground">
        {previewText()}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleSpeak} disabled={speaking}>
          <Volume2 className="h-3.5 w-3.5" />
          {t('routing.ura.voiceTestSpeak')}
        </Button>
        {speaking && (
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={handleStop}>
            <Square className="h-3.5 w-3.5" />
            {t('routing.ura.voiceTestStop')}
          </Button>
        )}
      </div>
      {extensionNumber.trim() && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">{t('routing.ura.voiceTestFromExt')}</label>
            <Input
              value={fromExtension}
              onChange={(e) => setFromExtension(e.target.value)}
              placeholder="1001"
              className="h-9"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={!fromExtension.trim() || dial.isPending}
            onClick={() => dial.mutate()}
          >
            <Phone className="h-3.5 w-3.5" />
            {dial.isPending ? t('routing.ura.voiceTestCalling') : t('routing.ura.voiceTestCall')}
          </Button>
        </div>
      )}
    </div>
  );
}
