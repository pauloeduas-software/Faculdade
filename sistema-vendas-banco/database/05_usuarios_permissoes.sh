#!/usr/bin/env bash
# =============================================================================
# Grupo 2 - Sistema de Vendas
# 05_usuarios_permissoes.sh: usuários do banco e permissões
#
#   grupo2             superusuário criado pela imagem (POSTGRES_USER). Dono das
#                      tabelas; só conecta pelo socket local do container
#                      (database/config/pg_hba.conf). Uso: administração.
#   grupo2_app         usuário da nossa API. Lê e grava dados, mas não altera
#                      a estrutura do banco.
#   grupo4_integracao  usuário do Grupo 4 (Estoque). Só LÊ a view do contrato.
#
# É um .sh (e não um .sql) para ler as senhas das variáveis de ambiente
# GRUPO2_APP_PASSWORD e GRUPO4_INTEGRACAO_PASSWORD em vez de deixá-las escritas
# no arquivo. O docker-entrypoint do Postgres executa este script na criação
# do banco, depois dos scripts 01 a 04.
#
# Princípio do menor privilégio: cada usuário recebe só o necessário para a
# sua função, e nada mais.
# =============================================================================
set -euo pipefail

: "${GRUPO2_APP_PASSWORD:?Defina GRUPO2_APP_PASSWORD no .env}"
: "${GRUPO4_INTEGRACAO_PASSWORD:?Defina GRUPO4_INTEGRACAO_PASSWORD no .env}"

# --set cria as variáveis do psql; no SQL, :'nome' as insere como literal entre
# aspas (com escape). O heredoc entre aspas ('EOSQL') impede o shell de expandir
# qualquer coisa dentro do SQL.
psql -v ON_ERROR_STOP=1 --no-psqlrc \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set senha_app="$GRUPO2_APP_PASSWORD" \
  --set senha_grupo4="$GRUPO4_INTEGRACAO_PASSWORD" <<'EOSQL'
BEGIN;

-- =============================================================================
-- Regras gerais do banco
-- =============================================================================

-- Por padrão o PostgreSQL deixa qualquer usuário (PUBLIC) conectar em
-- qualquer banco e criar tabelas temporárias. Retiramos isso: só conecta
-- quem recebe CONNECT explicitamente. O grupo2 é o dono e não é afetado.
REVOKE CONNECT ON DATABASE grupo2_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE grupo2_db FROM PUBLIC;

-- Ninguém além do dono usa ou cria objetos no schema public.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Schemas do domínio e da integração sem nenhum acesso para PUBLIC. Schemas
-- novos já nascem assim; o REVOKE deixa a intenção explícita.
REVOKE ALL ON SCHEMA vendas FROM PUBLIC;
REVOKE ALL ON SCHEMA integracao FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA integracao FROM PUBLIC;

-- =============================================================================
-- grupo2_app: usuário da API do Sistema de Vendas
-- =============================================================================

-- Não é superusuário (o padrão do CREATE ROLE já é NOSUPERUSER, NOCREATEDB,
-- NOCREATEROLE e NOREPLICATION). Se a senha vazar, quem a usar só consegue
-- mexer nos dados, nunca na estrutura do banco nem em outros bancos. O limite
-- de 20 conexões cobre o pool da API (10 por padrão) com folga.
CREATE ROLE grupo2_app LOGIN PASSWORD :'senha_app' CONNECTION LIMIT 20;

-- Conecta somente no grupo2_db (o pg_hba.conf também só libera esse banco).
GRANT CONNECT ON DATABASE grupo2_db TO grupo2_app;

-- USAGE deixa referenciar os objetos dos dois schemas. Sem CREATE, a API
-- não consegue criar tabelas, views ou funções neles.
GRANT USAGE ON SCHEMA vendas, integracao TO grupo2_app;

-- CRUD nas tabelas do domínio. Sem TRUNCATE, REFERENCES nem TRIGGER. ALTER e
-- DROP nem precisam ser negados: só o dono das tabelas (grupo2) pode fazê-los.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA vendas TO grupo2_app;

-- Sem GRANT nas sequences: as colunas são GENERATED ALWAYS AS IDENTITY, e o
-- INSERT na tabela já gera o id sem precisar de USAGE na sequence.

-- Logs do nosso consumidor. A execução é criada e depois atualizada (totais e
-- status); um erro só é inserido. Sem DELETE: o histórico de integrações não
-- pode ser apagado pela aplicação.
GRANT SELECT, INSERT, UPDATE ON integracao.integracao TO grupo2_app;
GRANT SELECT, INSERT ON integracao.erro_integracao TO grupo2_app;

-- A API pode consultar a mesma view que o Grupo 4 lê (ex.: tela de conferência).
GRANT SELECT ON integracao.vw_integracao_vendas TO grupo2_app;

-- Tabelas criadas no futuro pelo grupo2 nesses schemas recebem
-- automaticamente o mesmo padrão, sem precisar de um novo GRANT: CRUD no
-- domínio e só leitura e inclusão nos logs. Exceções ficam no script da
-- tabela (ex.: 07_consumo_entregas.sql tira o DELETE de vendas.entrega).
ALTER DEFAULT PRIVILEGES FOR ROLE grupo2 IN SCHEMA vendas
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grupo2_app;
ALTER DEFAULT PRIVILEGES FOR ROLE grupo2 IN SCHEMA integracao
  GRANT SELECT, INSERT ON TABLES TO grupo2_app;

-- Funções: por padrão o PostgreSQL deixa PUBLIC executar qualquer função.
-- Tiramos isso das nossas e das que forem criadas depois. As triggers não
-- dependem desse privilégio; só as duas funções auxiliares que as triggers de
-- item_venda chamam com PERFORM (e que rodam com o usuário que gravou o item)
-- precisam de EXECUTE para o grupo2_app.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA vendas, integracao FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE grupo2 REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vendas.fn_atualizar_valor_total(integer), vendas.fn_exigir_venda_aberta(integer) TO grupo2_app;

-- =============================================================================
-- grupo4_integracao: usuário do Grupo 4 (Sistema de Estoque)
-- =============================================================================

-- Usuário exclusivo da integração: o Grupo 4 nunca usa os nossos usuários.
-- Só LOGIN. O limite de 5 conexões impede que um erro no consumidor esgote
-- as conexões do nosso banco.
CREATE ROLE grupo4_integracao LOGIN PASSWORD :'senha_grupo4' CONNECTION LIMIT 5;

-- Toda transação do Grupo 4 começa somente leitura. É uma segunda barreira: a
-- sessão pode desligar esse padrão, por isso a proteção de verdade são os
-- GRANTs (ele não tem permissão de escrita em nada).
ALTER ROLE grupo4_integracao SET default_transaction_read_only = on;

-- Uma consulta pesada do consumidor é cancelada após 30s e não prende
-- recursos do nosso banco.
ALTER ROLE grupo4_integracao SET statement_timeout = '30s';

-- O Grupo 4 conecta somente no grupo2_db.
GRANT CONNECT ON DATABASE grupo2_db TO grupo4_integracao;

-- USAGE deixa o Grupo 4 referenciar objetos do schema integracao, mas não dá
-- acesso a nenhum deles (cada objeto precisa do próprio GRANT). Sem CREATE,
-- ele não consegue criar nada no schema.
GRANT USAGE ON SCHEMA integracao TO grupo4_integracao;

-- A única permissão sobre dados: SELECT na view do contrato. Sem INSERT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES ou TRIGGER. Como a view executa com as
-- permissões do dono, o Grupo 4 lê os dados sem acessar as tabelas de vendas.
GRANT SELECT ON integracao.vw_integracao_vendas TO grupo4_integracao;

-- Propositalmente SEM nenhum GRANT para o Grupo 4 em:
--   * schema vendas (tabelas internas do domínio);
--   * integracao.integracao e integracao.erro_integracao (logs do nosso consumidor).

COMMIT;
EOSQL
