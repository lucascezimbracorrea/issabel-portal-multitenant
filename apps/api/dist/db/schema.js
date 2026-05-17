import { boolean, float, int, mysqlTable, primaryKey, text, varchar } from 'drizzle-orm/mysql-core';
const nowFn = () => new Date().toISOString();
export const users = mysqlTable('users', {
    id: int('id').autoincrement().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 512 }),
    role: varchar('role', { length: 32 })
        .$type()
        .notNull(),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const organizations = mysqlTable('organizations', {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    tradeName: varchar('trade_name', { length: 255 }),
    active: boolean('active').notNull().default(true),
    appearance: text('appearance'),
    customDomain: varchar('custom_domain', { length: 255 }).unique(),
    customDomainVerifiedAt: varchar('custom_domain_verified_at', { length: 64 }),
    domainVerificationToken: varchar('domain_verification_token', { length: 128 }),
    issabelBaseUrl: varchar('issabel_base_url', { length: 512 }),
    orgKind: varchar('org_kind', { length: 16 })
        .$type()
        .notNull()
        .default('pabx'),
    extensionsLimit: int('extensions_limit'),
    channelsLimit: int('channels_limit'),
    diskQuotaGb: float('disk_quota_gb'),
    cdrMysql: text('cdr_mysql'),
    /** JSON: Issabel `pbxapi` base URL + admin credentials (server-side only). */
    issabelPbxApi: text('issabel_pbx_api'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const securityAutoConfig = mysqlTable('security_auto_config', {
    id: int('id').primaryKey(),
    enabled: boolean('enabled').notNull().default(true),
    blockWhat: varchar('block_what', { length: 16 })
        .$type()
        .notNull()
        .default('ip'),
    analysisPeriodSec: int('analysis_period_sec').notNull().default(2000),
    failuresPerExtension: int('failures_per_extension').notNull().default(5),
    failuresPerIp: int('failures_per_ip').notNull().default(50),
    block1Minutes: int('block1_minutes').notNull().default(60),
    block2Minutes: int('block2_minutes').notNull().default(1440),
    block3Minutes: int('block3_minutes').notNull().default(10080),
});
export const securityBlocklist = mysqlTable('security_blocklist', {
    id: int('id').autoincrement().primaryKey(),
    ip: varchar('ip', { length: 64 }).notNull(),
    port: int('port'),
    protocol: varchar('protocol', { length: 8 })
        .$type()
        .notNull()
        .default('udp'),
    blockedFrom: varchar('blocked_from', { length: 64 }).notNull(),
    blockedUntil: varchar('blocked_until', { length: 64 }),
    blockType: varchar('block_type', { length: 16 })
        .$type()
        .notNull()
        .default('manual'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const securityTrustlist = mysqlTable('security_trustlist', {
    id: int('id').autoincrement().primaryKey(),
    ip: varchar('ip', { length: 64 }).notNull(),
    port: int('port'),
    protocol: varchar('protocol', { length: 8 })
        .$type()
        .notNull()
        .default('udp'),
    releasedAt: varchar('released_at', { length: 64 }).notNull(),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const securityBlockLog = mysqlTable('security_block_log', {
    id: int('id').autoincrement().primaryKey(),
    ip: varchar('ip', { length: 64 }).notNull(),
    port: int('port'),
    protocol: varchar('protocol', { length: 8 }).notNull(),
    at: varchar('at', { length: 64 }).notNull(),
    blockType: varchar('block_type', { length: 16 })
        .$type()
        .notNull(),
    action: varchar('action', { length: 64 }).notNull(),
});
export const organizationMembers = mysqlTable('organization_members', {
    userId: int('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 })
        .$type()
        .notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.organizationId] })]);
export const spaces = mysqlTable('spaces', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 16 })
        .$type()
        .notNull()
        .default('active'),
});
export const extensions = mysqlTable('extensions', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    spaceId: int('space_id').references(() => spaces.id, { onDelete: 'set null' }),
    number: varchar('number', { length: 32 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    metadata: text('metadata'),
    source: varchar('source', { length: 16 })
        .$type()
        .notNull()
        .default('portal'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const webhookEndpoints = mysqlTable('webhook_endpoints', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    eventTypes: text('event_types').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const webhookDeliveries = mysqlTable('webhook_deliveries', {
    id: int('id').autoincrement().primaryKey(),
    endpointId: int('endpoint_id')
        .notNull()
        .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payload: text('payload').notNull(),
    status: varchar('status', { length: 16 })
        .$type()
        .notNull(),
    attempts: int('attempts').notNull().default(0),
    lastError: text('last_error'),
    httpStatus: int('http_status'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const integrations = mysqlTable('integrations', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    config: text('config').notNull(),
    status: varchar('status', { length: 16 })
        .$type()
        .notNull()
        .default('active'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const campaigns = mysqlTable('campaigns', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 })
        .$type()
        .notNull()
        .default('outbound'),
    status: varchar('status', { length: 16 })
        .$type()
        .notNull()
        .default('draft'),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const holidays = mysqlTable('holidays', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    date: varchar('date', { length: 10 }).notNull(),
    recurs: boolean('recurs').notNull().default(false),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const pauseTypes = mysqlTable('pause_types', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const costCenters = mysqlTable('cost_centers', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const extensionGroups = mysqlTable('extension_groups', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    extensionIds: text('extension_ids').notNull().default('[]'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const teams = mysqlTable('teams', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    extensionIds: text('extension_ids').notNull().default('[]'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const aiAgents = mysqlTable('ai_agents', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    model: varchar('model', { length: 64 }).notNull().default('gpt-4o-mini'),
    prompt: text('prompt').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const callFlows = mysqlTable('call_flows', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    graphJson: text('graph_json').notNull(),
    version: int('version').notNull().default(1),
    updatedAt: varchar('updated_at', { length: 64 }).$defaultFn(nowFn),
});
export const callReactionRules = mysqlTable('call_reaction_rules', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    featureKey: varchar('feature_key', { length: 64 }),
    priority: int('priority').notNull().default(100),
    enabled: boolean('enabled').notNull().default(true),
    actionKind: varchar('action_kind', { length: 32 })
        .$type()
        .notNull(),
    httpMethod: varchar('http_method', { length: 8 }),
    urlTemplate: text('url_template'),
    headersTemplate: text('headers_template'),
    bodyTemplate: text('body_template'),
    templateNameOrId: varchar('template_name_or_id', { length: 128 }),
    variableMapping: text('variable_mapping'),
    callFlowId: int('call_flow_id').references(() => callFlows.id, { onDelete: 'set null' }),
    nodeId: varchar('node_id', { length: 64 }),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const callReactionDeliveryLog = mysqlTable('call_reaction_delivery_log', {
    id: int('id').autoincrement().primaryKey(),
    ruleId: int('rule_id')
        .notNull()
        .references(() => callReactionRules.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 })
        .$type()
        .notNull(),
    httpStatus: int('http_status'),
    summary: text('summary'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const platformSettings = mysqlTable('platform_settings', {
    id: int('id').autoincrement().primaryKey(),
    key: varchar('key', { length: 128 }).notNull().unique(),
    value: text('value').notNull(),
});
export const queues = mysqlTable('queues', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    strategy: varchar('strategy', { length: 32 }).notNull().default('roundrobin'),
    timeout: int('timeout').notNull().default(30),
    maxCalls: int('max_calls'),
    musicOnHold: varchar('music_on_hold', { length: 128 }),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const conferenceRooms = mysqlTable('conference_rooms', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    roomNumber: varchar('room_number', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    pin: varchar('pin', { length: 20 }),
    maxParticipants: int('max_participants'),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const holdGroups = mysqlTable('hold_groups', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    mode: varchar('mode', { length: 16 }).notNull().default('files'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const trunks = mysqlTable('trunks', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 16 }).notNull().default('sip'),
    host: varchar('host', { length: 256 }),
    username: varchar('username', { length: 128 }),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const outboundRoutes = mysqlTable('outbound_routes', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    pattern: varchar('pattern', { length: 64 }).notNull(),
    trunkId: int('trunk_id').references(() => trunks.id, { onDelete: 'set null' }),
    prefix: varchar('prefix', { length: 32 }),
    priority: int('priority').notNull().default(0),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const campaignSchedules = mysqlTable('campaign_schedules', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    daysOfWeek: varchar('days_of_week', { length: 32 }).notNull().default('[1,2,3,4,5]'),
    startTime: varchar('start_time', { length: 8 }).notNull().default('08:00'),
    endTime: varchar('end_time', { length: 8 }).notNull().default('18:00'),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const campaignRatings = mysqlTable('campaign_ratings', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    maxAttempts: int('max_attempts').notNull().default(3),
    waitDays: int('wait_days').notNull().default(1),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
export const audioFiles = mysqlTable('audio_files', {
    id: int('id').autoincrement().primaryKey(),
    organizationId: int('organization_id')
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    filename: varchar('filename', { length: 256 }),
    description: text('description'),
    createdAt: varchar('created_at', { length: 64 }).$defaultFn(nowFn),
});
