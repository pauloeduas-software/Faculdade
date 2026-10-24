-- =============================================================================
-- Grupo 2 - Sistema de Vendas
-- 01_schema.sql: schema do domínio de vendas
--
-- As tabelas do sistema ficam no schema "vendas" (e não no "public") para
-- separar o domínio das estruturas que serão criadas para a integração.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS vendas;

COMMENT ON SCHEMA vendas IS 'Domínio do Sistema de Vendas (Grupo 2)';
