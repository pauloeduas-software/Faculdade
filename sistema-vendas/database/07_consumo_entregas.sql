-- =============================================================================
-- Grupo 2 - Sistema de Vendas
-- 07_consumo_entregas.sql: estrutura no NOSSO banco para receber as entregas
-- do Grupo 7 (Sistema de Entregas). O processo consumidor é escrito depois.
--
-- Os dados chegam da view integracao.vw_integracao_entregas do Grupo 7 e são
-- gravados aqui já transformados para o nosso modelo (nomes e vocabulário de
-- status nossos). Contrato: Docs/contrato_integracao_grupo7_grupo2.md
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- vendas.entrega: entregas das nossas vendas, no NOSSO modelo
-- -----------------------------------------------------------------------------
CREATE TABLE vendas.entrega (
  entrega_id           integer GENERATED ALWAYS AS IDENTITY,
  venda_id             integer      NOT NULL,
  id_entrega_origem    integer      NOT NULL,
  codigo_rastreio      varchar(30)  NOT NULL,
  status_entrega       varchar(20)  NOT NULL,
  data_prevista        date,
  data_saida           timestamptz,
  data_entrega         timestamptz,
  entregador           varchar(120),
  cidade               varchar(80),
  uf                   char(2),
  origem_atualizado_em timestamptz  NOT NULL,
  integrado_em         timestamptz  NOT NULL DEFAULT now(),
  atualizado_em        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_entrega PRIMARY KEY (entrega_id),
  CONSTRAINT fk_entrega_venda FOREIGN KEY (venda_id)
    REFERENCES vendas.venda (venda_id) ON DELETE RESTRICT,
  -- Estratégia de identificação: o id do Grupo 7 diz se a entrega já foi
  -- integrada (INSERT na primeira vez, UPDATE nas seguintes)
  CONSTRAINT uq_entrega_id_entrega_origem UNIQUE (id_entrega_origem),
  CONSTRAINT ck_entrega_status CHECK (
    status_entrega IN ('AGUARDANDO_COLETA', 'EM_TRANSPORTE', 'ENTREGUE', 'DEVOLVIDA', 'EXTRAVIADA', 'CANCELADA')
  ),
  -- Última barreira para dados que o consumidor também valida
  CONSTRAINT ck_entrega_entregue_com_data CHECK (status_entrega <> 'ENTREGUE' OR data_entrega IS NOT NULL),
  CONSTRAINT ck_entrega_datas CHECK (data_saida IS NULL OR data_entrega IS NULL OR data_entrega >= data_saida)
);

COMMENT ON TABLE vendas.entrega IS 'Entregas das vendas, integradas do Sistema de Entregas (Grupo 7)';
COMMENT ON COLUMN vendas.entrega.id_entrega_origem IS 'id_entrega no Grupo 7: identifica se o registro já foi integrado';
COMMENT ON COLUMN vendas.entrega.status_entrega IS 'Status no NOSSO vocabulário (de-para da situacao do Grupo 7)';
COMMENT ON COLUMN vendas.entrega.origem_atualizado_em IS 'ultima_alteracao recebida do Grupo 7; se mudar, o registro é atualizado';
COMMENT ON COLUMN vendas.entrega.integrado_em IS 'Quando a entrega foi integrada pela primeira vez';

CREATE INDEX idx_entrega_venda_id ON vendas.entrega (venda_id);

CREATE TRIGGER trg_entrega_atualizado_em
  BEFORE UPDATE ON vendas.entrega
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_set_atualizado_em();

-- -----------------------------------------------------------------------------
-- Log de execuções: registros lidos de novo que não tinham mudado
-- -----------------------------------------------------------------------------
ALTER TABLE integracao.integracao
  ADD COLUMN sem_alteracao integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN integracao.integracao.sem_alteracao IS
  'Registros lidos de novo cuja ultima_alteracao não mudou (nada a fazer)';

-- -----------------------------------------------------------------------------
-- O grupo2_app recebe SELECT, INSERT, UPDATE e DELETE pelo ALTER DEFAULT
-- PRIVILEGES do script 05. O consumidor só insere e atualiza entregas: o
-- DELETE sai (menor privilégio). Se as permissões não forem as esperadas, a
-- carga falha.
-- -----------------------------------------------------------------------------
REVOKE DELETE ON vendas.entrega FROM grupo2_app;

DO $$
BEGIN
  IF NOT (has_table_privilege('grupo2_app', 'vendas.entrega', 'SELECT')
          AND has_table_privilege('grupo2_app', 'vendas.entrega', 'INSERT')
          AND has_table_privilege('grupo2_app', 'vendas.entrega', 'UPDATE'))
     OR has_table_privilege('grupo2_app', 'vendas.entrega', 'DELETE')
     OR has_table_privilege('grupo2_app', 'vendas.entrega', 'TRUNCATE') THEN
    RAISE EXCEPTION 'grupo2_app não recebeu as permissões esperadas em vendas.entrega';
  END IF;
END;
$$;

COMMIT;
