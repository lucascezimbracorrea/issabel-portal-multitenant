import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRouteContext } from '@tanstack/react-router';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import type { Me } from '@/shared/types/me';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

const profileSchema = z
  .object({
    displayName: z.string().min(1).max(128),
    avatarUrl: z.string().max(512).optional(),
  })
  .superRefine((data, ctx) => {
    const v = (data.avatarUrl ?? '').trim();
    if (v && !/^https?:\/\//i.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['avatarUrl'], message: 'url' });
    }
  });

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: me.displayName, avatarUrl: me.avatarUrl ?? '' },
  });

  useEffect(() => {
    form.reset({ displayName: me.displayName, avatarUrl: me.avatarUrl ?? '' });
  }, [me.displayName, me.avatarUrl, form]);

  const save = useMutation({
    mutationFn: (body: { displayName?: string; avatarUrl?: string | null }) =>
      apiFetch<Me>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      toast.success(t('profile.saved'));
      await qc.invalidateQueries({ queryKey: qk.me() });
    },
    onError: () => toast.error(t('profile.saveFailed')),
  });

  const avatar = form.watch('avatarUrl')?.trim();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => {
              save.mutate({
                displayName: v.displayName,
                avatarUrl: v.avatarUrl?.trim() ? v.avatarUrl.trim() : null,
              });
            })}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('profile.displayName')}</label>
              <Input {...form.register('displayName')} autoComplete="name" />
              {form.formState.errors.displayName && (
                <p className="text-xs text-destructive">{form.formState.errors.displayName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('profile.avatarUrl')}</label>
              <Input {...form.register('avatarUrl')} placeholder="https://…" autoComplete="off" />
              <p className="text-xs text-muted-foreground">{t('profile.avatarHint')}</p>
              {form.formState.errors.avatarUrl && (
                <p className="text-xs text-destructive">{t('profile.avatarUrlInvalid')}</p>
              )}
            </div>
            {avatar && /^https?:\/\//i.test(avatar) && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <img
                  src={avatar}
                  alt=""
                  className="h-14 w-14 rounded-full border border-border object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="text-xs text-muted-foreground">{t('profile.avatarPreview')}</span>
              </div>
            )}
            <Button type="submit" disabled={save.isPending}>
              {t('actions.save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
