import { useMemo } from 'react';
import { Outlet, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, LogOut, Menu, AlertTriangle, Info, AlertCircle, CheckCheck, User } from 'lucide-react';
import { AppSidebar } from '@/widgets/app-sidebar';
import { BrandingProvider } from '@/widgets/branding-provider';
import { ThemeToggle } from '@/widgets/theme-toggle';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { SearchableSelect, type SearchableSelectOption } from '@/shared/ui/searchable-select';
import { useNotifications, useMobileSidebar, type AppNotification } from '@/shared/stores/ui-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  platform_admin: { label: 'Admin', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200' },
  org_admin: { label: 'Org Admin', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' },
  org_operator: { label: 'Operator', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200' },
  org_viewer: { label: 'Viewer', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (type === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <Info className="h-4 w-4 text-teal-500" />;
}

function NotificationBell() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 max-h-[28rem] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="overflow-y-auto max-h-[22rem]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50 last:border-0',
                  !n.read && 'bg-teal-50/60 dark:bg-teal-950/20',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <NotificationIcon type={n.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm', !n.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  {formatRelative(n.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function userInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

export function AppShell() {
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { open: mobileOpen, toggle: toggleMobile, setOpen: setMobileOpen } = useMobileSidebar();

  const lang = i18n.language.startsWith('pt') ? 'pt' : i18n.language.startsWith('es') ? 'es' : 'en';
  const langOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'en', label: 'English', keywords: ['english', 'en'] },
      { value: 'pt', label: 'Português', keywords: ['portuguese', 'pt', 'brasil'] },
      { value: 'es', label: 'Español', keywords: ['spanish', 'es'] },
    ],
    [],
  );

  const roleInfo = ROLE_LABELS[me.role] ?? { label: me.role, cls: 'bg-slate-100 text-slate-700' };

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    qc.removeQueries({ queryKey: qk.me() });
    void navigate({ to: '/login' });
  }

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 h-full min-h-[100dvh] md:relative md:z-auto md:h-full md:min-h-0 md:self-stretch',
          mobileOpen ? 'block' : 'hidden md:flex',
        )}
      >
        <AppSidebar me={me} onNavClick={() => setMobileOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card/90 px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleMobile}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            <SearchableSelect
              className="w-[9rem]"
              options={langOptions}
              value={lang}
              onValueChange={(v) => void i18n.changeLanguage(v)}
              placeholder="Language"
              searchPlaceholder={t('nav.langSearch')}
              emptyText={t('nav.langEmpty')}
            />
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-xs font-semibold text-muted-foreground ring-offset-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={t('nav.userMenu')}
                >
                  {me.avatarUrl && /^https?:\/\//i.test(me.avatarUrl) ? (
                    <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    userInitials(me.displayName)
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{me.displayName}</p>
                    <p className="truncate text-xs leading-none text-muted-foreground">{me.email}</p>
                    <span
                      className={cn(
                        'mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        roleInfo.cls,
                      )}
                    >
                      {roleInfo.label}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void navigate({ to: '/profile' })}>
                  <User className="mr-2 h-4 w-4" />
                  {t('nav.myProfile')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-100/80 via-background to-teal-50/30 p-4 md:p-6 dark:from-background dark:via-background dark:to-teal-950/20">
          <BrandingProvider me={me}>
            <Outlet />
          </BrandingProvider>
        </main>
      </div>
    </div>
  );
}
