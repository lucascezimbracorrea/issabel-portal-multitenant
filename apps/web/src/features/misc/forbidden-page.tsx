import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t('page.forbiddenTitle')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('page.forbiddenBody')}</p>
      <Link to="/" className="text-sm text-primary underline">
        {t('actions.back')}
      </Link>
    </div>
  );
}
