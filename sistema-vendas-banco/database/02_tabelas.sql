-- =============================================================================
-- Grupo 2 - Sistema de Vendas
-- 02_tabelas.sql: tabelas, constraints, índices e triggers do schema vendas
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Função genérica de auditoria: mantém atualizado_em com o horário da alteração.
-- O consumidor da integração usa essa coluna para detectar registros alterados,
-- por isso um UPDATE que não muda nenhum valor não altera o timestamp.
-- -----------------------------------------------------------------------------
--
-- Argumentos da trigger = colunas que ficam fora da comparação. Uma coluna
-- GENERATED (item_venda.subtotal) ainda não foi calculada no BEFORE UPDATE: em
-- NEW ela vale NULL, e a linha pareceria sempre alterada.
CREATE OR REPLACE FUNCTION vendas.fn_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ignorar text[] := coalesce(TG_ARGV::text[], '{}');
BEGIN
  IF (to_jsonb(NEW) - ignorar) IS DISTINCT FROM (to_jsonb(OLD) - ignorar) THEN
    NEW.atualizado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- cliente
-- -----------------------------------------------------------------------------
CREATE TABLE vendas.cliente (
  cliente_id    integer GENERATED ALWAYS AS IDENTITY,
  nome          varchar(120) NOT NULL,
  cpf           char(11)     NOT NULL,
  email         varchar(150),
  telefone      varchar(20),
  cidade        varchar(80),
  uf            char(2),
  ativo         boolean      NOT NULL DEFAULT true,
  criado_em     timestamptz  NOT NULL DEFAULT now(),
  atualizado_em timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_cliente PRIMARY KEY (cliente_id),
  CONSTRAINT uq_cliente_cpf UNIQUE (cpf),
  CONSTRAINT uq_cliente_email UNIQUE (email),
  CONSTRAINT ck_cliente_cpf CHECK (cpf ~ '^[0-9]{11}$'),
  CONSTRAINT ck_cliente_nome CHECK (btrim(nome) <> '')
);

COMMENT ON TABLE vendas.cliente IS 'Clientes que realizam compras';
COMMENT ON COLUMN vendas.cliente.cpf IS 'CPF somente com dígitos (11 caracteres)';

-- -----------------------------------------------------------------------------
-- vendedor
-- -----------------------------------------------------------------------------
CREATE TABLE vendas.vendedor (
  vendedor_id         integer GENERATED ALWAYS AS IDENTITY,
  nome                varchar(120)  NOT NULL,
  email               varchar(150)  NOT NULL,
  comissao_percentual numeric(5,2)  NOT NULL,
  ativo               boolean       NOT NULL DEFAULT true,
  criado_em           timestamptz   NOT NULL DEFAULT now(),
  atualizado_em       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_vendedor PRIMARY KEY (vendedor_id),
  CONSTRAINT uq_vendedor_email UNIQUE (email),
  CONSTRAINT ck_vendedor_comissao CHECK (comissao_percentual BETWEEN 0 AND 100),
  CONSTRAINT ck_vendedor_nome CHECK (btrim(nome) <> '')
);

COMMENT ON TABLE vendas.vendedor IS 'Vendedores responsáveis pelas vendas';

-- -----------------------------------------------------------------------------
-- produto
-- -----------------------------------------------------------------------------
CREATE TABLE vendas.produto (
  produto_id     integer GENERATED ALWAYS AS IDENTITY,
  codigo_sku     varchar(30)   NOT NULL,
  nome           varchar(120)  NOT NULL,
  descricao      text,
  preco_unitario numeric(12,2) NOT NULL,
  ativo          boolean       NOT NULL DEFAULT true,
  criado_em      timestamptz   NOT NULL DEFAULT now(),
  atualizado_em  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_produto PRIMARY KEY (produto_id),
  CONSTRAINT uq_produto_codigo_sku UNIQUE (codigo_sku),
  CONSTRAINT ck_produto_preco CHECK (preco_unitario > 0),
  -- O SKU é a chave do produto no Estoque (contrato com o Grupo 4)
  CONSTRAINT ck_produto_sku CHECK (codigo_sku ~ '^PRD-[0-9]{4}$'),
  CONSTRAINT ck_produto_nome CHECK (btrim(nome) <> '')
);

COMMENT ON TABLE vendas.produto IS 'Catálogo de produtos vendidos';
COMMENT ON COLUMN vendas.produto.codigo_sku IS 'Código do produto no formato PRD-0001';

-- -----------------------------------------------------------------------------
-- venda
-- -----------------------------------------------------------------------------
CREATE TABLE vendas.venda (
  venda_id        integer GENERATED ALWAYS AS IDENTITY,
  cliente_id      integer       NOT NULL,
  vendedor_id     integer       NOT NULL,
  data_venda      timestamptz   NOT NULL DEFAULT now(),
  status          varchar(20)   NOT NULL DEFAULT 'ABERTA',
  forma_pagamento varchar(20)   NOT NULL,
  valor_total     numeric(12,2) NOT NULL DEFAULT 0,
  observacao      text,
  criado_em       timestamptz   NOT NULL DEFAULT now(),
  atualizado_em   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_venda PRIMARY KEY (venda_id),
  CONSTRAINT fk_venda_cliente FOREIGN KEY (cliente_id)
    REFERENCES vendas.cliente (cliente_id) ON DELETE RESTRICT,
  CONSTRAINT fk_venda_vendedor FOREIGN KEY (vendedor_id)
    REFERENCES vendas.vendedor (vendedor_id) ON DELETE RESTRICT,
  CONSTRAINT ck_venda_status CHECK (
    status IN ('ABERTA', 'CONFIRMADA', 'CANCELADA', 'EM_ENTREGA', 'ENTREGUE')
  ),
  CONSTRAINT ck_venda_forma_pagamento CHECK (
    forma_pagamento IN ('PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO')
  )
);

COMMENT ON TABLE vendas.venda IS 'Cabeçalho das vendas';
COMMENT ON COLUMN vendas.venda.valor_total IS 'Soma dos subtotais dos itens, mantida pela trigger trg_item_venda_valor_total';

-- -----------------------------------------------------------------------------
-- item_venda
-- -----------------------------------------------------------------------------
CREATE TABLE vendas.item_venda (
  item_venda_id  integer GENERATED ALWAYS AS IDENTITY,
  venda_id       integer       NOT NULL,
  produto_id     integer       NOT NULL,
  quantidade     integer       NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  subtotal       numeric(12,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  atualizado_em  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_item_venda PRIMARY KEY (item_venda_id),
  CONSTRAINT fk_item_venda_venda FOREIGN KEY (venda_id)
    REFERENCES vendas.venda (venda_id) ON DELETE CASCADE,
  CONSTRAINT fk_item_venda_produto FOREIGN KEY (produto_id)
    REFERENCES vendas.produto (produto_id) ON DELETE RESTRICT,
  CONSTRAINT uq_item_venda_venda_produto UNIQUE (venda_id, produto_id),
  CONSTRAINT ck_item_venda_quantidade CHECK (quantidade > 0),
  CONSTRAINT ck_item_venda_preco CHECK (preco_unitario > 0)
);

COMMENT ON TABLE vendas.item_venda IS 'Itens (produtos) de cada venda';
COMMENT ON COLUMN vendas.item_venda.preco_unitario IS 'Preço do produto no momento da venda';

-- -----------------------------------------------------------------------------
-- Índices
-- item_venda(venda_id) não tem índice próprio: o índice da constraint
-- uq_item_venda_venda_produto começa por venda_id e já atende às buscas.
-- -----------------------------------------------------------------------------
CREATE INDEX idx_venda_cliente_id      ON vendas.venda (cliente_id);
CREATE INDEX idx_venda_vendedor_id     ON vendas.venda (vendedor_id);
CREATE INDEX idx_venda_data_venda      ON vendas.venda (data_venda);
CREATE INDEX idx_venda_status          ON vendas.venda (status);
CREATE INDEX idx_item_venda_produto_id ON vendas.item_venda (produto_id);

-- -----------------------------------------------------------------------------
-- Triggers de atualizado_em
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_cliente_atualizado_em
  BEFORE UPDATE ON vendas.cliente
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_set_atualizado_em();

CREATE TRIGGER trg_vendedor_atualizado_em
  BEFORE UPDATE ON vendas.vendedor
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_set_atualizado_em();

CREATE TRIGGER trg_produto_atualizado_em
  BEFORE UPDATE ON vendas.produto
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_set_atualizado_em();

CREATE TRIGGER trg_venda_atualizado_em
  BEFORE UPDATE ON vendas.venda
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_set_atualizado_em();

CREATE TRIGGER trg_item_venda_atualizado_em
  BEFORE UPDATE ON vendas.item_venda
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_set_atualizado_em('subtotal');

-- -----------------------------------------------------------------------------
-- Recalcula venda.valor_total como a soma dos subtotais dos itens da venda.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vendas.fn_atualizar_valor_total(p_venda_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trava a venda antes de somar: se duas transações alterarem itens da mesma
  -- venda ao mesmo tempo, a segunda espera a primeira terminar e soma já
  -- enxergando os itens que ela gravou.
  PERFORM 1 FROM vendas.venda WHERE venda_id = p_venda_id FOR UPDATE;

  UPDATE vendas.venda
     SET valor_total = COALESCE(
           (SELECT sum(i.subtotal) FROM vendas.item_venda i WHERE i.venda_id = p_venda_id),
           0)
   WHERE venda_id = p_venda_id;
END;
$$;

CREATE OR REPLACE FUNCTION vendas.fn_item_venda_valor_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM vendas.fn_atualizar_valor_total(NEW.venda_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM vendas.fn_atualizar_valor_total(NEW.venda_id);
    -- Item movido para outra venda: a venda de origem também muda de total
    IF NEW.venda_id <> OLD.venda_id THEN
      PERFORM vendas.fn_atualizar_valor_total(OLD.venda_id);
    END IF;
  ELSE
    PERFORM vendas.fn_atualizar_valor_total(OLD.venda_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_item_venda_valor_total
  AFTER INSERT OR UPDATE OR DELETE ON vendas.item_venda
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_item_venda_valor_total();

-- -----------------------------------------------------------------------------
-- Regras do contrato de integração com o Grupo 4 (Estoque), garantidas no banco
-- para valer também fora da API (ex.: SQL direto no psql).
--
-- Cada regra usa um SQLSTATE próprio, que a API converte em resposta HTTP
-- (server/http/errorHandler.ts):
--   VD001  SKU de produto já vendido não pode mudar        → 409 OPERACAO_NAO_PERMITIDA
--   VD002  itens só mudam enquanto a venda está ABERTA     → 409 VENDA_NAO_ABERTA
--   VD003  só venda ABERTA pode ser excluída               → 409 OPERACAO_NAO_PERMITIDA
--   VD004  transição de status fora da sequência permitida → 422 TRANSICAO_INVALIDA
-- -----------------------------------------------------------------------------

-- VD001: o SKU é a chave que o Estoque usa para dar baixa. Se ele mudasse depois
-- de vendido, as linhas da view mudariam de produto sem o Estoque perceber.
CREATE OR REPLACE FUNCTION vendas.fn_produto_sku_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo_sku IS DISTINCT FROM OLD.codigo_sku
     AND EXISTS (SELECT 1 FROM vendas.item_venda WHERE produto_id = OLD.produto_id) THEN
    RAISE EXCEPTION 'O SKU do produto % (%) não pode ser alterado porque o produto já foi vendido',
      OLD.produto_id, OLD.codigo_sku
      USING ERRCODE = 'VD001',
            HINT = 'O SKU é a chave usada pelo Sistema de Estoque. Para usar outro SKU, cadastre um novo produto e inative este.';
  END IF;
  RETURN NEW;
END;
$$;

-- "OF codigo_sku": a trigger só dispara em UPDATEs que mencionam a coluna
CREATE TRIGGER trg_produto_sku_imutavel
  BEFORE UPDATE OF codigo_sku ON vendas.produto
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_produto_sku_imutavel();

-- VD002: depois que a venda sai de ABERTA o Estoque pode já ter dado baixa nos
-- itens, então eles não podem mais ser incluídos, alterados nem removidos.
CREATE OR REPLACE FUNCTION vendas.fn_exigir_venda_aberta(p_venda_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_status varchar(20);
BEGIN
  -- FOR UPDATE (a mesma trava de fn_atualizar_valor_total): impede que outra
  -- transação confirme a venda entre esta verificação e a gravação do item
  SELECT status INTO v_status FROM vendas.venda WHERE venda_id = p_venda_id FOR UPDATE;

  -- Venda não encontrada: num INSERT a FK rejeita logo em seguida; num DELETE em
  -- cascata (exclusão de uma venda ABERTA) a venda já foi removida e o item vai junto
  IF FOUND AND v_status <> 'ABERTA' THEN
    RAISE EXCEPTION 'Os itens da venda % não podem ser alterados: a venda está %', p_venda_id, v_status
      USING ERRCODE = 'VD002',
            HINT = 'Itens só podem ser incluídos, alterados ou removidos enquanto a venda está ABERTA.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION vendas.fn_item_venda_exigir_venda_aberta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM vendas.fn_exigir_venda_aberta(NEW.venda_id);
    RETURN NEW;
  END IF;

  PERFORM vendas.fn_exigir_venda_aberta(OLD.venda_id);
  IF TG_OP = 'UPDATE' THEN
    -- Item movido para outra venda: a de destino também precisa estar ABERTA
    IF NEW.venda_id <> OLD.venda_id THEN
      PERFORM vendas.fn_exigir_venda_aberta(NEW.venda_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_item_venda_exigir_venda_aberta
  BEFORE INSERT OR UPDATE OR DELETE ON vendas.item_venda
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_item_venda_exigir_venda_aberta();

-- VD003: completa a VD002. Sem ela, excluir uma venda ENTREGUE levaria os itens
-- junto pelo ON DELETE CASCADE, e as linhas sumiriam da view do Estoque.
CREATE OR REPLACE FUNCTION vendas.fn_venda_exclusao_somente_aberta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'ABERTA' THEN
    RAISE EXCEPTION 'A venda % não pode ser excluída: está %', OLD.venda_id, OLD.status
      USING ERRCODE = 'VD003',
            HINT = 'Somente vendas ABERTAS podem ser excluídas. Para desistir de uma venda CONFIRMADA, mude o status para CANCELADA.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_venda_exclusao_somente_aberta
  BEFORE DELETE ON vendas.venda
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_venda_exclusao_somente_aberta();

-- VD004: a mesma matriz de transições da API (TRANSICOES_STATUS em
-- server/modules/vendas/vendas.schema.ts), valendo também para SQL direto.
-- ENTREGUE e CANCELADA são finais; nada volta para ABERTA, então uma venda que
-- o Estoque já viu nunca sai da view. Mudar para o mesmo status não é transição.
CREATE OR REPLACE FUNCTION vendas.fn_venda_transicao_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'ABERTA' THEN
      RAISE EXCEPTION 'Uma venda nova começa ABERTA, não %', NEW.status
        USING ERRCODE = 'VD004',
              HINT = 'Crie a venda ABERTA e mude o status depois: ABERTA → CONFIRMADA → EM_ENTREGA → ENTREGUE.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) NOT IN (('ABERTA', 'CONFIRMADA'), ('ABERTA', 'CANCELADA'),
                                      ('CONFIRMADA', 'EM_ENTREGA'), ('CONFIRMADA', 'CANCELADA'),
                                      ('EM_ENTREGA', 'ENTREGUE')) THEN
    RAISE EXCEPTION 'Transição de status inválida na venda %: % → %', OLD.venda_id, OLD.status, NEW.status
      USING ERRCODE = 'VD004',
            HINT = 'Permitido: ABERTA → CONFIRMADA → EM_ENTREGA → ENTREGUE, e ABERTA ou CONFIRMADA → CANCELADA. ENTREGUE e CANCELADA são finais.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_venda_transicao_status
  BEFORE INSERT OR UPDATE OF status ON vendas.venda
  FOR EACH ROW EXECUTE FUNCTION vendas.fn_venda_transicao_status();

COMMIT;
