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
  } finally {
    conn.release();
  }
}
