import { pool } from './client.js';

export async function initSchema() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`SET FOREIGN_KEY_CHECKS = 0`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(512) DEFAULT NULL,
  role VARCHAR(32) NOT NULL,
  created_at VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  active TINYINT(1) NOT NULL DEFAULT 1,
  appearance TEXT,
  custom_domain VARCHAR(255) UNIQUE,
  custom_domain_verified_at VARCHAR(64),
  domain_verification_token VARCHAR(128),
  issabel_base_url VARCHAR(512),
  org_kind VARCHAR(16) NOT NULL DEFAULT 'pabx',
  extensions_limit INT,
  channels_limit INT,
  disk_quota_gb FLOAT,
  cdr_mysql TEXT,
  issabel_pbx_api TEXT,
  created_at VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS organization_members (
  user_id INT NOT NULL,
  organization_id INT NOT NULL,
  role VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, organization_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS spaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS extensions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  space_id INT,
  number VARCHAR(32) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  metadata TEXT,
  source VARCHAR(16) NOT NULL DEFAULT 'portal',
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  event_types TEXT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  status VARCHAR(16) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  http_status INT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  type VARCHAR(64) NOT NULL,
  config TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'outbound',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  date VARCHAR(10) NOT NULL,
  recurs TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS pause_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  description TEXT,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS cost_centers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS extension_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  extension_ids TEXT NOT NULL DEFAULT ('[]'),
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  extension_ids TEXT NOT NULL DEFAULT ('[]'),
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS ai_agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(64) NOT NULL DEFAULT 'gpt-4o-mini',
  prompt TEXT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS call_flows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  graph_json TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS call_reaction_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  feature_key VARCHAR(64),
  priority INT NOT NULL DEFAULT 100,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  action_kind VARCHAR(32) NOT NULL,
  http_method VARCHAR(8),
  url_template TEXT,
  headers_template TEXT,
  body_template TEXT,
  template_name_or_id VARCHAR(128),
  variable_mapping TEXT,
  call_flow_id INT,
  node_id VARCHAR(64),
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (call_flow_id) REFERENCES call_flows(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS call_reaction_delivery_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_id INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  http_status INT,
  summary TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (rule_id) REFERENCES call_reaction_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  \`key\` VARCHAR(128) NOT NULL UNIQUE,
  value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS queues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  strategy VARCHAR(32) NOT NULL DEFAULT 'roundrobin',
  timeout INT NOT NULL DEFAULT 30,
  max_calls INT,
  music_on_hold VARCHAR(128),
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS conference_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  pin VARCHAR(20),
  max_participants INT,
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS hold_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  mode VARCHAR(16) NOT NULL DEFAULT 'files',
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS trunks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'sip',
  host VARCHAR(256),
  username VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS outbound_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  pattern VARCHAR(64) NOT NULL,
  trunk_id INT,
  prefix VARCHAR(32),
  priority INT NOT NULL DEFAULT 0,
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (trunk_id) REFERENCES trunks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS campaign_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  days_of_week VARCHAR(32) NOT NULL DEFAULT '[1,2,3,4,5]',
  start_time VARCHAR(8) NOT NULL DEFAULT '08:00',
  end_time VARCHAR(8) NOT NULL DEFAULT '18:00',
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS campaign_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(20) NOT NULL,
  max_attempts INT NOT NULL DEFAULT 3,
  wait_days INT NOT NULL DEFAULT 1,
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS audio_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  filename VARCHAR(256),
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS inbound_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  number VARCHAR(32) NOT NULL,
  route_type VARCHAR(16) NOT NULL DEFAULT 'none',
  destination_id INT,
  max_concurrent_calls INT NOT NULL DEFAULT 0,
  register_enabled TINYINT(1) NOT NULL DEFAULT 0,
  record_calls TINYINT(1) NOT NULL DEFAULT 0,
  schedule_json TEXT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  description TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY inbound_numbers_org_number (organization_id, number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS uras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  extension_number VARCHAR(32) NOT NULL,
  initial_audio_id INT,
  repetitions INT NOT NULL DEFAULT 2,
  allow_direct_dial TINYINT(1) NOT NULL DEFAULT 0,
  schedule_enabled TINYINT(1) NOT NULL DEFAULT 0,
  schedule_json TEXT NOT NULL,
  dtmf_actions_json TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at VARCHAR(64) DEFAULT NULL,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (initial_audio_id) REFERENCES audio_files(id) ON DELETE SET NULL,
  UNIQUE KEY uras_org_ext (organization_id, extension_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS security_auto_config (
  id INT PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  block_what VARCHAR(16) NOT NULL DEFAULT 'ip',
  analysis_period_sec INT NOT NULL DEFAULT 2000,
  failures_per_extension INT NOT NULL DEFAULT 5,
  failures_per_ip INT NOT NULL DEFAULT 50,
  block1_minutes INT NOT NULL DEFAULT 60,
  block2_minutes INT NOT NULL DEFAULT 1440,
  block3_minutes INT NOT NULL DEFAULT 10080
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
INSERT IGNORE INTO security_auto_config
  (id, enabled, block_what, analysis_period_sec, failures_per_extension, failures_per_ip, block1_minutes, block2_minutes, block3_minutes)
VALUES (1, 1, 'ip', 2000, 5, 50, 60, 1440, 10080)`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS security_blocklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(64) NOT NULL,
  port INT,
  protocol VARCHAR(8) NOT NULL DEFAULT 'udp',
  blocked_from VARCHAR(64) NOT NULL,
  blocked_until VARCHAR(64),
  block_type VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS security_trustlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(64) NOT NULL,
  port INT,
  protocol VARCHAR(8) NOT NULL DEFAULT 'udp',
  released_at VARCHAR(64) NOT NULL,
  created_at VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS security_block_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(64) NOT NULL,
  port INT,
  protocol VARCHAR(8) NOT NULL,
  at VARCHAR(64) NOT NULL,
  block_type VARCHAR(16) NOT NULL,
  action VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`SET FOREIGN_KEY_CHECKS = 1`);

    try {
      await conn.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Duplicate column name')) throw e;
    }

    try {
      await conn.query('ALTER TABLE organizations ADD COLUMN issabel_pbx_api TEXT NULL');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Duplicate column name')) throw e;
    }

    await conn.query(`
CREATE TABLE IF NOT EXISTS queue_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  queue_id INT NOT NULL,
  extension_id INT,
  agent_label VARCHAR(128) NOT NULL,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS internal_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  short_number VARCHAR(32) NOT NULL,
  dest_type VARCHAR(32) NOT NULL,
  destination_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const columnAlters = [
      'ALTER TABLE call_flows ADD COLUMN extension_number VARCHAR(32) NULL',
      'ALTER TABLE call_flows ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1',
      'ALTER TABLE queues ADD COLUMN queue_code VARCHAR(16) NULL',
      'ALTER TABLE conference_rooms ADD COLUMN settings_json TEXT NOT NULL DEFAULT \'{}\'',
      'ALTER TABLE hold_groups ADD COLUMN audio_file_id INT NULL',
      'ALTER TABLE trunks ADD COLUMN password VARCHAR(256) NULL',
      'ALTER TABLE trunks ADD COLUMN cut_digits VARCHAR(16) NULL',
      'ALTER TABLE trunks ADD COLUMN insert_digits VARCHAR(16) NULL',
      'ALTER TABLE trunks ADD COLUMN dynamic_host TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE trunks ADD COLUMN use_default_codecs TINYINT(1) NOT NULL DEFAULT 1',
      'ALTER TABLE trunks ADD COLUMN codecs TEXT NOT NULL DEFAULT \'[]\'',
      'ALTER TABLE trunks ADD COLUMN forward_raw TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE trunks ADD COLUMN register_status VARCHAR(32) NULL',
      'ALTER TABLE trunks ADD COLUMN tariffs_json TEXT NOT NULL DEFAULT \'[]\'',
    ];
    for (const sql of columnAlters) {
      try {
        await conn.query(sql);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('Duplicate column name')) throw e;
      }
    }

    await conn.query(`
CREATE TABLE IF NOT EXISTS hotel_properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  external_hotel_id VARCHAR(128) NOT NULL,
  ipbx_url VARCHAR(512) NOT NULL,
  ramal_cloud_api_base VARCHAR(512),
  token_secret VARCHAR(128) NOT NULL DEFAULT 'i360-pswd',
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  room_number VARCHAR(32) NOT NULL,
  extension_number VARCHAR(32) NOT NULL,
  extension_id INT,
  status VARCHAR(16) NOT NULL DEFAULT 'vacant',
  floor VARCHAR(16),
  notes TEXT,
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (property_id) REFERENCES hotel_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS hotel_stays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  guest_name VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  job_id INT,
  ramal_pass_enc TEXT,
  ramal_domain VARCHAR(255),
  checked_in_at VARCHAR(64),
  checked_out_at VARCHAR(64),
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (room_id) REFERENCES hotel_rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS crm_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  external_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(64),
  phone_normalized VARCHAR(32),
  status VARCHAR(64),
  source VARCHAR(128),
  raw_json TEXT,
  synced_at VARCHAR(64) NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_crm_lead_org_ext (organization_id, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS hotel_interaction_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  room_id INT,
  stay_id INT,
  type VARCHAR(32) NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (stay_id) REFERENCES hotel_stays(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    try {
      await conn.query('ALTER TABLE hotel_stays ADD COLUMN planned_check_out VARCHAR(64) NULL');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Duplicate column name')) throw e;
    }

    try {
      await conn.query('ALTER TABLE campaigns ADD COLUMN external_discador_id VARCHAR(64) NULL');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('Duplicate column name')) throw e;
    }

    const uraAiCols = [
      "ALTER TABLE uras ADD COLUMN ura_mode VARCHAR(16) NOT NULL DEFAULT 'classic'",
      'ALTER TABLE uras ADD COLUMN ai_instructions TEXT NULL',
      'ALTER TABLE uras ADD COLUMN elevenlabs_agent_id VARCHAR(128) NULL',
      'ALTER TABLE uras ADD COLUMN portal_ai_agent_id INT NULL',
      'ALTER TABLE uras ADD COLUMN use_ai_instructions TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE uras ADD COLUMN use_json TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE uras ADD COLUMN json_content TEXT NULL',
      'ALTER TABLE uras ADD COLUMN initial_message TEXT NULL',
      'ALTER TABLE uras ADD COLUMN use_initial_message TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE uras ADD COLUMN google_docs_url VARCHAR(512) NULL',
      'ALTER TABLE uras ADD COLUMN use_google_docs TINYINT(1) NOT NULL DEFAULT 0',
    ];
    for (const sql of uraAiCols) {
      try {
        await conn.query(sql);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('Duplicate column name')) throw e;
      }
    }

    await conn.query(`
CREATE TABLE IF NOT EXISTS issabel_apply_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  resource_type VARCHAR(32) NOT NULL,
  resource_id INT NOT NULL,
  bundle_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  processed_at VARCHAR(64),
  created_at VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`
CREATE TABLE IF NOT EXISTS crm_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  external_id VARCHAR(64) NOT NULL,
  lead_external_id VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(64),
  phone_normalized VARCHAR(32),
  raw_json TEXT,
  synced_at VARCHAR(64) NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_crm_client_org_ext (organization_id, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } finally {
    conn.release();
  }
}
