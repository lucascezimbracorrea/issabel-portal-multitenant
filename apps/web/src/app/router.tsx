import { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, createRoute, createRouter, isRedirect, redirect } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { LoginPage } from '@/features/auth/login-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { ExtensionsPage } from '@/features/extensions/extensions-page';
import { ExtensionFormPage } from '@/features/extensions/extension-form-page';
import { IntegrationsHubPage } from '@/features/integrations/integrations-hub-page';
import { CallFlowsPage } from '@/features/integrations/call-flows-page';
import { WhatsappPage } from '@/features/integrations/whatsapp-page';
import { AiAgentsPage } from '@/features/integrations/ai-agents-page';
import { ForbiddenPage } from '@/features/misc/forbidden-page';
import { CallsPage } from '@/features/calls/calls-page';
import { CallsLayout } from '@/features/calls/calls-layout';
import { CallsOnlinePage } from '@/features/calls/calls-online-page';
import { CallsHistoryPage } from '@/features/calls/calls-history-page';
import { DiagnosticsPage } from '@/features/diagnostics/diagnostics-page';
import { OrganizationsPage } from '@/features/organizations/organizations-page';
import { OrganizationDetailPage } from '@/features/organizations/organization-detail-page';
import { PbxConsolePage } from '@/features/pbx/pbx-console-page';
import { PbxFeaturesPage } from '@/features/pbx/pbx-features-page';
import { PbxInboundNumbersPage } from '@/features/pbx/pbx-inbound-numbers-page';
import { PbxCallsPage } from '@/features/pbx/pbx-calls-page';
import { PbxReportsConsolePage } from '@/features/pbx/pbx-reports-console-page';
import { PbxSettingsConsolePage } from '@/features/pbx/pbx-settings-console-page';
import { PbxTerminationPage } from '@/features/pbx/pbx-termination-page';
import { PbxVoicemailPage } from '@/features/pbx/pbx-voicemail-page';
import { ReportsPage } from '@/features/reports/reports-page';
import { SecurityLayout } from '@/features/security/security-layout';
import { SecurityBlocklistPage } from '@/features/security/security-blocklist-page';
import { SecurityTrustlistPage } from '@/features/security/security-trustlist-page';
import { SecurityAutoPage } from '@/features/security/security-auto-page';
import { SecurityLogsPage } from '@/features/security/security-logs-page';
import { UsersPage } from '@/features/users/users-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { ProfilePage } from '@/features/profile/profile-page';
import { WebhooksPage } from '@/features/webhooks/webhooks-page';
// Campaign sub-pages
import { CampaignListPage, CampaignSchedulesPage, CampaignAudioPage, CampaignRatingsPage } from '@/features/pbx/sub/campaigns-sub-pages';
// People sub-pages
import { PbxPeoplePage, ExtensionGroupsPage, TeamsPage } from '@/features/pbx/sub/people-sub-pages';
// Calls sub-pages
import { CallRecordingsPage } from '@/features/pbx/sub/calls-sub-pages';
// Termination sub-pages
import { CallingPlanPage, TrunksPage } from '@/features/pbx/sub/termination-sub-pages';
// Features sub-pages
import {
  AudioFilesPage, QueuesPage, CallFlowsFeaturePage, HoldGroupPage,
  InternalNumbersPage, ConferenceRoomsPage, UrasPage,
} from '@/features/pbx/sub/features-sub-pages';
// Reports sub-pages
import {
  ReportQueuesPage, ReportOperationsPage, ReportDetailPage,
  ReportExportsPage, ReportAsrPage, ReportAgentsPage, ReportCampaignPage,
} from '@/features/pbx/sub/reports-sub-pages';
// Settings sub-pages
import {
  CostCenterPage, GeneralSettingsPage, SystemInfoPage, HolidaysPage, PauseListPage,
} from '@/features/pbx/sub/settings-sub-pages';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { canAccessDiagnostics } from '@/shared/lib/can';
import type { Me } from '@/shared/types/me';
import { AppShell } from '@/widgets/app-shell';
import { PagePending } from '@/shared/ui/page-pending';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      Not found — check the URL or return to the dashboard.
    </div>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: LoginPage,
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.fetchQuery({
        queryKey: qk.me(),
        queryFn: () => apiFetch<Me>('/me'),
      });
      throw redirect({ to: '/' });
    } catch (e) {
      if (isRedirect(e)) throw e;
    }
  },
});

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '403',
  component: ForbiddenPage,
});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_shell',
  component: AppShell,
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.fetchQuery({
        queryKey: qk.me(),
        queryFn: () => apiFetch<Me>('/me'),
      });
      return { me };
    } catch {
      throw redirect({ to: '/login' });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: DashboardPage,
  pendingComponent: PagePending,
});

const organizationsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'organizations',
  component: OrganizationsPage,
  pendingComponent: PagePending,
});

const organizationDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'organizations/$orgId',
  component: OrganizationDetailPage,
  pendingComponent: PagePending,
});

const callsLayout = createRoute({
  getParentRoute: () => shellRoute,
  path: 'calls',
  component: CallsLayout,
});

const callsIndexRoute = createRoute({
  getParentRoute: () => callsLayout,
  path: '/',
  component: CallsPage,
  pendingComponent: PagePending,
});

const callsOnlineRoute = createRoute({
  getParentRoute: () => callsLayout,
  path: 'online',
  component: CallsOnlinePage,
  pendingComponent: PagePending,
});

const callsHistoryRoute = createRoute({
  getParentRoute: () => callsLayout,
  path: 'history',
  component: CallsHistoryPage,
  pendingComponent: PagePending,
});

const usersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'users',
  component: UsersPage,
  pendingComponent: PagePending,
});

const securityLayout = createRoute({
  getParentRoute: () => shellRoute,
  path: 'security',
  component: SecurityLayout,
  beforeLoad: ({ context }) => {
    const me = (context as { me: Me }).me;
    if (me.role !== 'platform_admin') throw redirect({ to: '/403' });
  },
});

const securityIndexRoute = createRoute({
  getParentRoute: () => securityLayout,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/security/blocklist' });
  },
  component: () => null,
});

const securityBlocklistRoute = createRoute({
  getParentRoute: () => securityLayout,
  path: 'blocklist',
  component: SecurityBlocklistPage,
  pendingComponent: PagePending,
});

const securityTrustlistRoute = createRoute({
  getParentRoute: () => securityLayout,
  path: 'trustlist',
  component: SecurityTrustlistPage,
  pendingComponent: PagePending,
});

const securityAutoRoute = createRoute({
  getParentRoute: () => securityLayout,
  path: 'auto-config',
  component: SecurityAutoPage,
  pendingComponent: PagePending,
});

const securityLogsRoute = createRoute({
  getParentRoute: () => securityLayout,
  path: 'logs',
  component: SecurityLogsPage,
  pendingComponent: PagePending,
});

const reportsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'reports',
  component: ReportsPage,
  pendingComponent: PagePending,
});

const diagnosticsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'diagnostics',
  beforeLoad: ({ context }) => {
    const me = (context as { me: Me }).me;
    if (!canAccessDiagnostics(me.role)) throw redirect({ to: '/403' });
  },
  component: DiagnosticsPage,
  pendingComponent: PagePending,
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'settings',
  component: SettingsPage,
  pendingComponent: PagePending,
});

const profileRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'profile',
  component: ProfilePage,
  pendingComponent: PagePending,
});

const integrationsLayout = createRoute({
  getParentRoute: () => shellRoute,
  path: 'integrations',
  component: () => <Outlet />,
});

const integrationsIndexRoute = createRoute({
  getParentRoute: () => integrationsLayout,
  path: '/',
  component: IntegrationsHubPage,
});

const integrationsFlowsRoute = createRoute({
  getParentRoute: () => integrationsLayout,
  path: 'flows',
  component: CallFlowsPage,
});

const integrationsWhatsappRoute = createRoute({
  getParentRoute: () => integrationsLayout,
  path: 'whatsapp',
  component: WhatsappPage,
});

const integrationsAiRoute = createRoute({
  getParentRoute: () => integrationsLayout,
  path: 'ai',
  component: AiAgentsPage,
});

const extensionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'extensions',
  component: ExtensionsPage,
  pendingComponent: PagePending,
});

const extensionNewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'extensions/new',
  component: ExtensionFormPage,
  pendingComponent: PagePending,
});

const extensionDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'extensions/$extId',
  component: ExtensionFormPage,
  pendingComponent: PagePending,
});

const webhooksRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: 'webhooks',
  component: WebhooksPage,
  pendingComponent: PagePending,
});

// ─── PBX layout ───────────────────────────────────────────────────────────────

const pbxLayout = createRoute({
  getParentRoute: () => shellRoute,
  path: 'pbx',
  component: () => <Outlet />,
});

const pbxIndexRoute = createRoute({ getParentRoute: () => pbxLayout, path: '/', component: PbxConsolePage, pendingComponent: PagePending });
const pbxVoicemailRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'voicemail', component: PbxVoicemailPage, pendingComponent: PagePending });

// Campaigns
const pbxCampaignsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'campaigns', component: CampaignListPage, pendingComponent: PagePending });
const pbxCampaignSchedulesRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'campaigns/schedules', component: CampaignSchedulesPage, pendingComponent: PagePending });
const pbxCampaignAudioRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'campaigns/audio', component: CampaignAudioPage, pendingComponent: PagePending });
const pbxCampaignRatingsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'campaigns/ratings', component: CampaignRatingsPage, pendingComponent: PagePending });

// People
const pbxPeopleRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'people', component: PbxPeoplePage, pendingComponent: PagePending });
const pbxExtensionGroupsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'extension-groups', component: ExtensionGroupsPage, pendingComponent: PagePending });
const pbxTeamsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'teams', component: TeamsPage, pendingComponent: PagePending });

// Calls
const pbxCallsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'calls', component: PbxCallsPage, pendingComponent: PagePending });
const pbxCallRecordingsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'calls/recordings', component: CallRecordingsPage, pendingComponent: PagePending });

// Termination
const pbxTerminationRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'termination', component: PbxTerminationPage, pendingComponent: PagePending });
const pbxCallingPlanRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'termination/calling-plan', component: CallingPlanPage, pendingComponent: PagePending });
const pbxTrunksRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'termination/trunks', component: TrunksPage, pendingComponent: PagePending });

// Inbound
const pbxInboundNumbersRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'inbound-numbers', component: PbxInboundNumbersPage, pendingComponent: PagePending });

// Features
const pbxFeaturesRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features', component: PbxFeaturesPage, pendingComponent: PagePending });
const pbxFeatAudioRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/audio', component: AudioFilesPage, pendingComponent: PagePending });
const pbxFeatQueuesRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/queues', component: QueuesPage, pendingComponent: PagePending });
const pbxFeatCallFlowsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/call-flows', component: CallFlowsFeaturePage, pendingComponent: PagePending });
const pbxFeatHoldRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/hold-group', component: HoldGroupPage, pendingComponent: PagePending });
const pbxFeatInternalRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/internal-numbers', component: InternalNumbersPage, pendingComponent: PagePending });
const pbxFeatConfRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/conference-rooms', component: ConferenceRoomsPage, pendingComponent: PagePending });
const pbxFeatUrasRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'features/uras', component: UrasPage, pendingComponent: PagePending });

// Reports
const pbxReportsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports', component: PbxReportsConsolePage, pendingComponent: PagePending });
const pbxRepQueuesRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/queues', component: ReportQueuesPage, pendingComponent: PagePending });
const pbxRepOpsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/operations', component: ReportOperationsPage, pendingComponent: PagePending });
const pbxRepDetailRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/detail', component: ReportDetailPage, pendingComponent: PagePending });
const pbxRepExportsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/exports', component: ReportExportsPage, pendingComponent: PagePending });
const pbxRepAsrRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/asr', component: ReportAsrPage, pendingComponent: PagePending });
const pbxRepAgentsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/agents', component: ReportAgentsPage, pendingComponent: PagePending });
const pbxRepCampaignRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'reports/campaigns', component: ReportCampaignPage, pendingComponent: PagePending });

// Settings
const pbxSettingsRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'settings', component: PbxSettingsConsolePage, pendingComponent: PagePending });
const pbxSetCostRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'settings/cost-center', component: CostCenterPage, pendingComponent: PagePending });
const pbxSetGeneralRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'settings/general', component: GeneralSettingsPage, pendingComponent: PagePending });
const pbxSetSystemRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'settings/system', component: SystemInfoPage, pendingComponent: PagePending });
const pbxSetHolidaysRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'settings/holidays', component: HolidaysPage, pendingComponent: PagePending });
const pbxSetPausesRoute = createRoute({ getParentRoute: () => pbxLayout, path: 'settings/pauses', component: PauseListPage, pendingComponent: PagePending });

const routeTree = rootRoute.addChildren([
  loginRoute,
  forbiddenRoute,
  shellRoute.addChildren([
    indexRoute,
    organizationsRoute,
    organizationDetailRoute,
    callsLayout.addChildren([callsIndexRoute, callsOnlineRoute, callsHistoryRoute]),
    usersRoute,
    securityLayout.addChildren([
      securityIndexRoute,
      securityBlocklistRoute,
      securityTrustlistRoute,
      securityAutoRoute,
      securityLogsRoute,
    ]),
    reportsRoute,
    diagnosticsRoute,
    settingsRoute,
    profileRoute,
    integrationsLayout.addChildren([integrationsIndexRoute, integrationsFlowsRoute, integrationsWhatsappRoute, integrationsAiRoute]),
    extensionsRoute,
    extensionNewRoute,
    extensionDetailRoute,
    webhooksRoute,
    pbxLayout.addChildren([
      pbxIndexRoute,
      pbxVoicemailRoute,
      // Campaigns
      pbxCampaignsRoute,
      pbxCampaignSchedulesRoute,
      pbxCampaignAudioRoute,
      pbxCampaignRatingsRoute,
      // People
      pbxPeopleRoute,
      pbxExtensionGroupsRoute,
      pbxTeamsRoute,
      // Calls
      pbxCallsRoute,
      pbxCallRecordingsRoute,
      // Termination
      pbxTerminationRoute,
      pbxCallingPlanRoute,
      pbxTrunksRoute,
      // Inbound
      pbxInboundNumbersRoute,
      // Features
      pbxFeaturesRoute,
      pbxFeatAudioRoute,
      pbxFeatQueuesRoute,
      pbxFeatCallFlowsRoute,
      pbxFeatHoldRoute,
      pbxFeatInternalRoute,
      pbxFeatConfRoute,
      pbxFeatUrasRoute,
      // Reports
      pbxReportsRoute,
      pbxRepQueuesRoute,
      pbxRepOpsRoute,
      pbxRepDetailRoute,
      pbxRepExportsRoute,
      pbxRepAsrRoute,
      pbxRepAgentsRoute,
      pbxRepCampaignRoute,
      // Settings
      pbxSettingsRoute,
      pbxSetCostRoute,
      pbxSetGeneralRoute,
      pbxSetSystemRoute,
      pbxSetHolidaysRoute,
      pbxSetPausesRoute,
    ]),
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPendingComponent: PagePending,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
  interface FileRoutesByPath {
    '/_shell/organizations/$orgId': {
      parentRoute: typeof shellRoute;
    };
  }
}
