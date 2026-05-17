import { LayoutTemplate } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/shared/ui/card';

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <div className="flex items-center gap-3 bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-5 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 shadow-inner">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{t(titleKey)}</h1>
        </div>
        <CardContent className="p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">{t('page.placeholderBody')}</p>
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>{t('page.placeholderBullet1')}</li>
            <li>{t('page.placeholderBullet2')}</li>
            <li>{t('page.placeholderBullet3')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
