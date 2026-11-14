-- Banco do sistema de Vendas (Grupo 2). SQLite.

CREATE TABLE IF NOT EXISTS vendas (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_nome         TEXT    NOT NULL,
  cliente_documento    TEXT    NOT NULL,
  entrega_endereco     TEXT    NOT NULL,
  entrega_cidade       TEXT    NOT NULL,
  entrega_uf           TEXT    NOT NULL,
  entrega_cep          TEXT    NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'CONFIRMADA'
                       CHECK (status IN ('CONFIRMADA', 'CANCELADA')),
  motivo_cancelamento  TEXT,
  valor_total          REAL    NOT NULL CHECK (valor_total >= 0),
  idempotency_key      TEXT    UNIQUE,
  criado_em            TEXT    NOT NULL,
  atualizado_em        TEXT    NOT NULL
);

-- As vendas comecam no 101: o ambiente de testes do G7 tem entregas para as vendas 101 a 117.
-- So vale para banco novo; num banco que ja teve vendas, a numeracao continua de onde estava.
INSERT INTO sqlite_sequence (name, seq)
  SELECT 'vendas', 100 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'vendas');

CREATE TABLE IF NOT EXISTS itens_venda (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id        INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id      INTEGER NOT NULL,
  nome_produto    TEXT    NOT NULL,
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario  REAL    NOT NULL CHECK (preco_unitario >= 0),
  UNIQUE (venda_id, produto_id)
);

-- Entrega de cada venda, lida da API de Entregas (G7): id_entrega e codigo_rastreio guardados na
-- venda e status_entrega refletido nela (contrato do G7, regra 5). data_atualizacao e a do G7,
-- comparada com a leitura anterior para saber se a entrega mudou (regra 6).
CREATE TABLE IF NOT EXISTS entregas_venda (
  venda_id          INTEGER PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  id_entrega        INTEGER NOT NULL,
  codigo_rastreio   TEXT    NOT NULL,
  status_entrega    TEXT    NOT NULL,
  data_atualizacao  TEXT    NOT NULL,
  consultado_em     TEXT    NOT NULL
);

-- Registro das ocorrencias de integracao (ENTRADA = requisicoes recebidas, como as do
-- Estoque/G4; SAIDA = chamadas feitas pelo G2 a API de Entregas/G7).
CREATE TABLE IF NOT EXISTS integracao_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  direcao      TEXT    NOT NULL CHECK (direcao IN ('ENTRADA', 'SAIDA')),
  sistema      TEXT    NOT NULL,
  metodo       TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  status       INTEGER,
  duracao_ms   INTEGER NOT NULL,
  tentativa    INTEGER NOT NULL DEFAULT 1,
  erro         TEXT,
  correlacao   TEXT,
  criado_em    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status);
CREATE INDEX IF NOT EXISTS idx_vendas_criado_em ON vendas(criado_em);
CREATE INDEX IF NOT EXISTS idx_itens_venda ON itens_venda(venda_id);
CREATE INDEX IF NOT EXISTS idx_logs_correlacao ON integracao_logs(correlacao);
