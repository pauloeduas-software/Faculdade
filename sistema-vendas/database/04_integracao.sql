-- =============================================================================
-- Grupo 2 - Sistema de Vendas
-- 04_integracao.sql: estruturas de integração
--
-- PRODUTOR: view que o Grupo 4 (Sistema de Estoque) lê do nosso banco.
-- CONSUMIDOR: tabelas de log que o nosso processo consumidor (dados do
-- Grupo 7 - Entregas) vai usar para registrar execuções e erros.
-- Contrato: Docs/contrato_integracao_grupo2_grupo4.md
-- =============================================================================

BEGIN;

-- Schema separado do domínio: o que está aqui é "público" para outros
-- sistemas, e as tabelas internas (schema vendas) podem mudar sem quebrar o contrato
CREATE SCHEMA IF NOT EXISTS integracao;

COMMENT ON SCHEMA integracao IS 'Estruturas de integração do Sistema de Vendas (Grupo 2)';

-- -----------------------------------------------------------------------------
-- PRODUTOR: view para o Grupo 4 - Estoque
--
-- * Nomes de contrato diferentes dos internos e tipos fixados por CAST: se uma
--   coluna interna mudar, ajusta-se a view e o contrato continua o mesmo.
-- * A view executa com as permissões do dono (grupo2), então o Grupo 4 lê
--   estes dados sem ter acesso às tabelas do schema vendas.
-- * security_barrier: os filtros do consumidor só são aplicados depois do
--   WHERE da view, assim uma função na consulta dele não "enxerga" vendas ABERTAS.
-- -----------------------------------------------------------------------------
CREATE VIEW integracao.vw_integracao_vendas
WITH (security_barrier = true) AS
SELECT
  CAST(i.item_venda_id AS integer)                                AS codigo_item,
  CAST(v.venda_id AS integer)                                     AS codigo_venda,
  CAST(v.data_venda AS timestamptz)                               AS data_venda,
  CAST(v.status AS varchar(20))                                   AS status_venda,
  CAST(p.codigo_sku AS varchar(30))                               AS codigo_sku,
  CAST(p.nome AS varchar(120))                                    AS nome_produto,
  CAST(i.quantidade AS integer)                                   AS quantidade,
  CAST(i.preco_unitario AS numeric(12,2))                         AS preco_unitario,
  -- Qualquer alteração na venda, no item ou no produto (ex.: correção do nome)
  -- aparece para o consumidor como uma data_atualizacao mais recente
  CAST(GREATEST(v.atualizado_em, i.atualizado_em, p.atualizado_em) AS timestamptz) AS data_atualizacao
FROM vendas.venda v
JOIN vendas.item_venda i ON i.venda_id = v.venda_id
JOIN vendas.produto p ON p.produto_id = i.produto_id
-- ABERTA fica de fora: ainda pode ganhar/perder itens ou ser excluída
WHERE v.status IN ('CONFIRMADA', 'EM_ENTREGA', 'ENTREGUE', 'CANCELADA');

COMMENT ON VIEW integracao.vw_integracao_vendas IS
  'Itens vendidos, para o Sistema de Estoque (Grupo 4). Uma linha por item, somente de vendas '
  'CONFIRMADA, EM_ENTREGA, ENTREGUE ou CANCELADA. Contrato v1.4.';

COMMENT ON COLUMN integracao.vw_integracao_vendas.codigo_item IS
  'Identificador único da linha (item da venda). Chave para o consumidor saber se o registro já foi integrado.';
COMMENT ON COLUMN integracao.vw_integracao_vendas.codigo_venda IS
  'Identificador da venda à qual o item pertence. Vários itens podem ter o mesmo codigo_venda.';
COMMENT ON COLUMN integracao.vw_integracao_vendas.data_venda IS
  'Data e hora da venda, com fuso horário.';
COMMENT ON COLUMN integracao.vw_integracao_vendas.status_venda IS
  'Status da venda: CONFIRMADA, EM_ENTREGA ou ENTREGUE = produto saiu (dar baixa); CANCELADA = estornar o que já foi baixado.';
COMMENT ON COLUMN integracao.vw_integracao_vendas.codigo_sku IS
  'Código do produto no formato PRD-0000. Chave para localizar o produto no Estoque.';
COMMENT ON COLUMN integracao.vw_integracao_vendas.nome_produto IS
  'Nome do produto no cadastro de Vendas. Apenas informativo.';
COMMENT ON COLUMN integracao.vw_integracao_vendas.quantidade IS
  'Quantidade vendida do produto (inteiro maior que zero).';
COMMENT ON COLUMN integracao.vw_integracao_vendas.preco_unitario IS
  'Preço unitário praticado na venda, em reais (2 casas decimais).';
COMMENT ON COLUMN integracao.vw_integracao_vendas.data_atualizacao IS
  'Última alteração da venda, do item ou do produto. Se mudou desde a última leitura, o registro deve ser reprocessado.';

-- -----------------------------------------------------------------------------
-- CONSUMIDOR: log das execuções de integração
-- -----------------------------------------------------------------------------
CREATE TABLE integracao.integracao (
  integracao_id   integer GENERATED ALWAYS AS IDENTITY,
  data_inicio     timestamptz NOT NULL DEFAULT now(),
  data_fim        timestamptz,
  sistema_origem  varchar(50) NOT NULL,
  sistema_destino varchar(50) NOT NULL,
  total_registros integer     NOT NULL DEFAULT 0,
  processados     integer     NOT NULL DEFAULT 0,
  inseridos       integer     NOT NULL DEFAULT 0,
  atualizados     integer     NOT NULL DEFAULT 0,
  rejeitados      integer     NOT NULL DEFAULT 0,
  status          varchar(30) NOT NULL DEFAULT 'EM_ANDAMENTO',
  mensagem        text,
  CONSTRAINT pk_integracao PRIMARY KEY (integracao_id),
  CONSTRAINT ck_integracao_status CHECK (
    status IN ('EM_ANDAMENTO', 'CONCLUIDA', 'CONCLUIDA_COM_ERROS', 'FALHOU')
  )
);

COMMENT ON TABLE integracao.integracao IS 'Uma linha por execução do processo de integração (consumidor)';
COMMENT ON COLUMN integracao.integracao.mensagem IS 'Resumo da execução ou motivo da falha';

-- -----------------------------------------------------------------------------
-- CONSUMIDOR: erros encontrados em cada execução
-- -----------------------------------------------------------------------------
CREATE TABLE integracao.erro_integracao (
  erro_id         integer GENERATED ALWAYS AS IDENTITY,
  integracao_id   integer     NOT NULL,
  registro_origem varchar(50),
  campo           varchar(60),
  tipo_erro       varchar(40) NOT NULL,
  descricao       text        NOT NULL,
  valor_recebido  text,
  data_ocorrencia timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_erro_integracao PRIMARY KEY (erro_id),
  CONSTRAINT fk_erro_integracao_integracao FOREIGN KEY (integracao_id)
    REFERENCES integracao.integracao (integracao_id) ON DELETE CASCADE,
  CONSTRAINT ck_erro_integracao_tipo CHECK (
    tipo_erro IN ('CAMPO_OBRIGATORIO', 'TIPO_INVALIDO', 'VALOR_INVALIDO', 'REGISTRO_DUPLICADO',
                  'REGISTRO_INEXISTENTE', 'REGRA_NEGOCIO', 'ERRO_ESTRUTURAL', 'ERRO_CONEXAO')
  )
);

COMMENT ON TABLE integracao.erro_integracao IS 'Problemas encontrados durante uma execução de integração';
COMMENT ON COLUMN integracao.erro_integracao.registro_origem IS 'Identificador do registro no sistema de origem';
COMMENT ON COLUMN integracao.erro_integracao.valor_recebido IS 'Valor recebido como texto, para análise e correção';

CREATE INDEX idx_erro_integracao_integracao_id ON integracao.erro_integracao (integracao_id);
CREATE INDEX idx_integracao_data_inicio ON integracao.integracao (data_inicio);

COMMIT;
