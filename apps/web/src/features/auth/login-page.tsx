import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { normalizeHslComponents } from '@/shared/lib/branding-css';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { ThemeToggle } from '@/widgets/theme-toggle';
import { Skeleton } from '@/shared/ui/skeleton';
import { LOGIN_DEFAULT_BRAND_LOGO_URL, LOGIN_SIDE_BACKGROUND_URL } from '@/shared/config/brand-assets';
import { SearchableSelect, type SearchableSelectOption } from '@/shared/ui/searchable-select';

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

type Form = z.infer<typeof schema>;

function loginLogoUrl(appearance: Record<string, unknown>): string {
  const raw = appearance.logoUrl;
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw.trim())) return raw.trim();
  return LOGIN_DEFAULT_BRAND_LOGO_URL;
}

const BRAND_PANEL = '#00B48D';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('pt') ? 'pt' : i18n.language.startsWith('es') ? 'es' : 'en';
  const langOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'en', label: 'English', keywords: ['english', 'en', 'inglês'] },
      { value: 'pt', label: 'Português', keywords: ['portuguese', 'pt', 'brasil'] },
      { value: 'es', label: 'Español', keywords: ['spanish', 'es', 'castellano'] },
    ],
    [],
  );
  const qc = useQueryClient();
  const navigate = useNavigate();
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const [showPassword, setShowPassword] = useState(false);

  const branding = useQuery({
    queryKey: qk.brandingHost(host),
    queryFn: () =>
      apiFetch<{ organizationId: number | null; tradeName?: string; appearance: Record<string, string> }>(
        `/public/branding-by-host?host=${encodeURIComponent(host)}`,
      ),
  });

  const login = useMutation({
    mutationFn: (body: Form) =>
      apiFetch<{ user: { id: number; email: string; displayName: string; role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.me() });
      void navigate({ to: '/' });
    },
    onError: () => toast.error(t('login.error')),
  });

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const a = (branding.data?.appearance ?? {}) as Record<string, unknown>;
  const primary = normalizeHslComponents(typeof a.primary === 'string' ? a.primary : undefined);
  const logoSrc = loginLogoUrl(a);
  const trade = branding.data?.tradeName?.trim() || t('login.sideTitle');

  return (
    <div
      className="flex min-h-[100dvh] flex-col lg:flex-row"
      style={
        primary
          ? ({
              ['--primary' as string]: primary,
            } as CSSProperties)
          : undefined
      }
    >
      {/* Mobile top bar — same idea as hotel-hub */}
      <div
        className="flex items-center justify-center gap-3 py-6 text-white lg:hidden"
        style={{ backgroundColor: BRAND_PANEL }}
      >
        {branding.isLoading ? (
          <Skeleton className="h-10 w-10 rounded-lg bg-white/20" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/20 p-1">
            <img src={logoSrc} alt="" className="h-full w-full object-contain" width={40} height={40} />
          </div>
        )}
        <h1 className="text-xl font-bold">{trade}</h1>
      </div>

      {/* Left — hero image + overlay (desktop) */}
      <div
        className="relative hidden flex-1 flex-col items-center justify-center px-8 py-12 lg:flex"
        style={{
          backgroundImage: `url(${LOGIN_SIDE_BACKGROUND_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/70 to-indigo-900/80" />
        <div className="relative z-10 mx-auto max-w-lg text-center text-white">
          <div className="mb-8 flex justify-center">
            {branding.isLoading ? (
              <Skeleton className="h-16 w-16 rounded-2xl bg-white/20" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/20 p-2 backdrop-blur-sm">
                <img src={logoSrc} alt="" className="h-full w-full object-contain" width={64} height={64} />
              </div>
            )}
          </div>
          <h2 className="mb-4 text-4xl font-bold drop-shadow-sm">{trade}</h2>
          <p className="mb-8 text-xl text-blue-100">{t('login.sideKicker')}</p>
          <div className="inline-block rounded-lg border border-white/30 bg-white/20 px-6 py-3 backdrop-blur-sm">
            <span className="font-medium text-white">{t('login.pill')}</span>
          </div>
          {typeof a.loginTagline === 'string' && a.loginTagline.trim() ? (
            <p className="mt-8 text-sm text-teal-100/90">{a.loginTagline}</p>
          ) : (
            <p className="mt-8 text-sm text-white/85">{t('login.sideMessage')}</p>
          )}
        </div>
      </div>

      {/* Right — form */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
        style={{ backgroundColor: BRAND_PANEL }}
      >
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h2 className="mb-2 hidden text-3xl font-bold text-white lg:block">{t('login.title')}</h2>
            <h2 className="mb-2 text-2xl font-bold text-white lg:hidden">{t('login.title')}</h2>
            <p className="text-white/85">{t('login.cardHelp')}</p>
          </div>

          <Card className="border-0 bg-white/85 shadow-xl backdrop-blur-sm dark:bg-card/90">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{t('login.title')}</CardTitle>
                <div className="flex items-center gap-2">
                  <SearchableSelect
                    className="w-[9.5rem]"
                    options={langOptions}
                    value={lang}
                    onValueChange={(v) => void i18n.changeLanguage(v)}
                    placeholder="Language"
                    searchPlaceholder={t('nav.langSearch')}
                    emptyText={t('nav.langEmpty')}
                  />
                  <ThemeToggle />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((v) => {
                  login.mutate(v);
                })}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('login.email')}</label>
                  <Input autoComplete="username" className="h-11" {...form.register('email')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('login.password')}</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="h-11 pr-11"
                      {...form.register('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword((prev: boolean) => !prev)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full font-medium text-white shadow-md"
                  style={{
                    backgroundColor: BRAND_PANEL,
                    boxShadow: '0 4px 14px 0 rgba(0, 180, 141, 0.35)',
                  }}
                  disabled={login.isPending}
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('login.entering')}
                    </>
                  ) : (
                    t('login.submit')
                  )}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-xs" disabled>
                  {t('login.forgot')} — {t('login.forgotSoon')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
