import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Briefcase,
  FileText,
  Hash,
  LayoutDashboard,
  Megaphone,
  Network,
  Phone,
  PhoneCall,
  Puzzle,
  SlidersHorizontal,
  Settings,
  Shield,
  UserRound,
  Users,
  Voicemail,
  Webhook,
} from 'lucide-react';
import type { Role } from '@/shared/lib/can';

export type NavChild = {
  id: string;
  i18nKey: string;
  to: string;
};

export type NavItem = {
  id: string;
  i18nKey: string;
  to: string;
  icon: LucideIcon;
  group: 'platform' | 'pbx';
  /** If set, user must have one of these roles */
  roles?: Role[];
  /** Expandable sub-items shown below the parent */
  children?: NavChild[];
};

/** Platform-admin–only management nav */
export const navPlatform: NavItem[] = [
  { id: 'dash', i18nKey: 'nav.dashboard', to: '/', icon: LayoutDashboard, group: 'platform', roles: ['platform_admin'] },
  { id: 'orgs', i18nKey: 'nav.companies', to: '/organizations', icon: Briefcase, group: 'platform', roles: ['platform_admin'] },
  { id: 'users', i18nKey: 'nav.users', to: '/users', icon: Users, group: 'platform', roles: ['platform_admin'] },
  { id: 'sec', i18nKey: 'nav.security', to: '/security', icon: Shield, group: 'platform', roles: ['platform_admin'] },
  { id: 'rep', i18nKey: 'nav.reports', to: '/reports', icon: FileText, group: 'platform', roles: ['platform_admin'] },
  { id: 'diag', i18nKey: 'nav.diagnostics', to: '/diagnostics', icon: Activity, group: 'platform', roles: ['platform_admin'] },
  { id: 'set', i18nKey: 'nav.settings', to: '/settings', icon: Settings, group: 'platform', roles: ['platform_admin'] },
  {
    id: 'int', i18nKey: 'nav.integrations', to: '/integrations', icon: Puzzle, group: 'platform', roles: ['platform_admin'],
    children: [
      { id: 'int-http', i18nKey: 'nav.intHttp', to: '/integrations' },
      { id: 'int-wa', i18nKey: 'nav.intWhatsApp', to: '/integrations/whatsapp' },
      { id: 'int-ai', i18nKey: 'nav.intAi', to: '/integrations/ai' },
      { id: 'int-flows', i18nKey: 'nav.intFlows', to: '/integrations/flows' },
      { id: 'int-wh', i18nKey: 'nav.webhooks', to: '/webhooks' },
    ],
  },
];

/** Org-user nav: shown to org_admin / org_operator / org_viewer when inside an org */
export const navOrg: NavItem[] = [
  { id: 'rep', i18nKey: 'nav.reports', to: '/reports', icon: FileText, group: 'platform' },
  {
    id: 'int', i18nKey: 'nav.integrations', to: '/integrations', icon: Puzzle, group: 'platform',
    children: [
      { id: 'int-http', i18nKey: 'nav.intHttp', to: '/integrations' },
      { id: 'int-wa', i18nKey: 'nav.intWhatsApp', to: '/integrations/whatsapp' },
      { id: 'int-ai', i18nKey: 'nav.intAi', to: '/integrations/ai' },
      { id: 'int-flows', i18nKey: 'nav.intFlows', to: '/integrations/flows' },
      { id: 'int-wh', i18nKey: 'nav.webhooks', to: '/webhooks' },
    ],
  },
  { id: 'set', i18nKey: 'nav.settings', to: '/settings', icon: Settings, group: 'platform' },
];

/** PBX org-context nav — visible when an org is selected */
export const navPbx: NavItem[] = [
  {
    id: 'vm',
    i18nKey: 'nav.voicemail',
    to: '/pbx/voicemail',
    icon: Voicemail,
    group: 'pbx',
  },
  {
    id: 'pbxdash',
    i18nKey: 'nav.pbxConsole',
    to: '/pbx',
    icon: BarChart3,
    group: 'pbx',
  },
  {
    id: 'camp',
    i18nKey: 'nav.campaigns',
    to: '/pbx/campaigns',
    icon: Megaphone,
    group: 'pbx',
    children: [
      { id: 'camp-list', i18nKey: 'nav.campaignList', to: '/pbx/campaigns' },
      { id: 'camp-sched', i18nKey: 'nav.campaignSchedules', to: '/pbx/campaigns/schedules' },
      { id: 'camp-audio', i18nKey: 'nav.campaignAudio', to: '/pbx/campaigns/audio' },
      { id: 'camp-ratings', i18nKey: 'nav.campaignRatings', to: '/pbx/campaigns/ratings' },
    ],
  },
  {
    id: 'ext',
    i18nKey: 'nav.extensions',
    to: '/extensions',
    icon: UserRound,
    group: 'pbx',
    children: [
      { id: 'ext-list', i18nKey: 'nav.extensionList', to: '/extensions' },
      { id: 'ext-people', i18nKey: 'nav.peopleList', to: '/pbx/people' },
      { id: 'ext-groups', i18nKey: 'nav.extensionGroups', to: '/pbx/extension-groups' },
      { id: 'ext-teams', i18nKey: 'nav.teams', to: '/pbx/teams' },
    ],
  },
  {
    id: 'calls',
    i18nKey: 'nav.calls',
    to: '/calls',
    icon: Phone,
    group: 'pbx',
    children: [
      { id: 'calls-hist', i18nKey: 'nav.callHistory', to: '/calls/history' },
      { id: 'calls-online', i18nKey: 'nav.callsOnline', to: '/calls/online' },
      { id: 'calls-rec', i18nKey: 'nav.recordings', to: '/pbx/calls/recordings' },
    ],
  },
  {
    id: 'term',
    i18nKey: 'nav.termination',
    to: '/pbx/termination',
    icon: Network,
    group: 'pbx',
    children: [
      { id: 'term-plan', i18nKey: 'nav.callingPlan', to: '/pbx/termination/calling-plan' },
      { id: 'term-trunks', i18nKey: 'nav.trunks', to: '/pbx/termination/trunks' },
    ],
  },
  {
    id: 'did',
    i18nKey: 'nav.inboundNumbers',
    to: '/pbx/inbound-numbers',
    icon: Hash,
    group: 'pbx',
  },
  {
    id: 'feat',
    i18nKey: 'nav.pbxFeatures',
    to: '/pbx/features',
    icon: SlidersHorizontal,
    group: 'pbx',
    children: [
      { id: 'feat-audio', i18nKey: 'nav.audioFiles', to: '/pbx/features/audio' },
      { id: 'feat-queues', i18nKey: 'nav.queues', to: '/pbx/features/queues' },
      { id: 'feat-flows', i18nKey: 'nav.callFlows', to: '/pbx/features/call-flows' },
      { id: 'feat-hold', i18nKey: 'nav.holdGroup', to: '/pbx/features/hold-group' },
      { id: 'feat-internal', i18nKey: 'nav.internalNumbers', to: '/pbx/features/internal-numbers' },
      { id: 'feat-conf', i18nKey: 'nav.conferenceRooms', to: '/pbx/features/conference-rooms' },
      { id: 'feat-uras', i18nKey: 'nav.uras', to: '/pbx/features/uras' },
    ],
  },
  {
    id: 'rep',
    i18nKey: 'nav.pbxReports',
    to: '/pbx/reports',
    icon: FileText,
    group: 'pbx',
    children: [
      { id: 'rep-queues', i18nKey: 'nav.reportQueues', to: '/pbx/reports/queues' },
      { id: 'rep-ops', i18nKey: 'nav.reportOperations', to: '/pbx/reports/operations' },
      { id: 'rep-detail', i18nKey: 'nav.reportDetail', to: '/pbx/reports/detail' },
      { id: 'rep-exports', i18nKey: 'nav.reportExports', to: '/pbx/reports/exports' },
      { id: 'rep-asr', i18nKey: 'nav.reportAsr', to: '/pbx/reports/asr' },
      { id: 'rep-agents', i18nKey: 'nav.reportAgents', to: '/pbx/reports/agents' },
      { id: 'rep-campaign', i18nKey: 'nav.reportCampaign', to: '/pbx/reports/campaigns' },
    ],
  },
  {
    id: 'pbxset',
    i18nKey: 'nav.pbxSettings',
    to: '/pbx/settings',
    icon: Settings,
    group: 'pbx',
    children: [
      { id: 'set-cost', i18nKey: 'nav.costCenter', to: '/pbx/settings/cost-center' },
      { id: 'set-general', i18nKey: 'nav.generalSettings', to: '/pbx/settings/general' },
      { id: 'set-system', i18nKey: 'nav.systemInfo', to: '/pbx/settings/system' },
      { id: 'set-holidays', i18nKey: 'nav.holidays', to: '/pbx/settings/holidays' },
      { id: 'set-pauses', i18nKey: 'nav.pauseList', to: '/pbx/settings/pauses' },
    ],
  },
  {
    id: 'pcalls',
    i18nKey: 'nav.pbxCalls',
    to: '/pbx/calls',
    icon: PhoneCall,
    group: 'pbx',
  },
  {
    id: 'int',
    i18nKey: 'nav.integrations',
    to: '/integrations',
    icon: Puzzle,
    group: 'pbx',
    children: [
      { id: 'int-http', i18nKey: 'nav.intHttp', to: '/integrations' },
      { id: 'int-wa', i18nKey: 'nav.intWhatsApp', to: '/integrations/whatsapp' },
      { id: 'int-ai', i18nKey: 'nav.intAi', to: '/integrations/ai' },
      { id: 'int-flows', i18nKey: 'nav.intFlows', to: '/integrations/flows' },
      { id: 'int-wh', i18nKey: 'nav.webhooks', to: '/webhooks' },
    ],
  },
];

export function filterNav(items: NavItem[], role: Role) {
  return items.filter((it) => !it.roles || it.roles.includes(role));
}
