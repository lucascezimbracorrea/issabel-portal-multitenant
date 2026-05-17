-- Issabel Portal — base de dados da aplicação (não é a base CDR do Asterisk).
-- Executar como administrador MySQL, por exemplo:
--   mysql -u root -p < scripts/create-database.sql
-- ou:
--   mysql -u root -p -e "source $(pwd)/scripts/create-database.sql"

CREATE DATABASE IF NOT EXISTS issabel_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Utilizador dedicado (opcional). Ajusta a palavra-passe e o host (% ou localhost).
-- CREATE USER IF NOT EXISTS 'portal'@'localhost' IDENTIFIED BY 'ALTERE_ESTA_PASSWORD';
-- GRANT ALL PRIVILEGES ON issabel_portal.* TO 'portal'@'localhost';
-- CREATE USER IF NOT EXISTS 'portal'@'%' IDENTIFIED BY 'ALTERE_ESTA_PASSWORD';
-- GRANT ALL PRIVILEGES ON issabel_portal.* TO 'portal'@'%';
-- FLUSH PRIVILEGES;
