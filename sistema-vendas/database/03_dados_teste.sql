-- =============================================================================
-- Grupo 2 - Sistema de Vendas
-- 03_dados_teste.sql: dados de teste do schema vendas
--
-- As datas das vendas 1 a 30 são relativas ao dia da carga (últimos 60 dias).
-- As vendas 101 a 107 têm número e data fixos: são as combinadas com os Grupos
-- 5 e 7 para os testes da integração (orientacao-consumo-grupo2.md, seção 3).
-- O valor_total das vendas NÃO é informado aqui: ele é calculado pela trigger
-- trg_item_venda_valor_total conforme os itens são inseridos.
-- =============================================================================

-- current_date no fuso de Brasília: no fuso do container (UTC), depois das
-- 21h o "hoje" já seria amanhã e todas as datas andariam um dia
SET TimeZone = 'America/Sao_Paulo';

BEGIN;

-- -----------------------------------------------------------------------------
-- Clientes (15, sendo 2 inativos). CPFs fictícios com dígitos verificadores válidos.
-- -----------------------------------------------------------------------------
INSERT INTO vendas.cliente (nome, cpf, email, telefone, cidade, uf, ativo) VALUES
  ('Maria Aparecida Souza',   '15881399803', 'maria.souza@email.com',      '(62) 98123-4567', 'Goiânia',              'GO', true),
  ('João Pedro Oliveira',     '69879730917', 'joao.oliveira@email.com',    '(62) 99234-5678', 'Aparecida de Goiânia', 'GO', true),
  ('Ana Carolina Ferreira',   '11417075350', 'ana.ferreira@email.com',     '(62) 98345-6789', 'Anápolis',             'GO', true),
  ('Lucas Gabriel Almeida',   '64556815177', 'lucas.almeida@email.com',    '(64) 99456-7890', 'Rio Verde',            'GO', true),
  ('Juliana Martins Rocha',   '88447294072', 'juliana.rocha@email.com',    '(62) 98567-8901', 'Goiânia',              'GO', true),
  ('Rafael Henrique Costa',   '55761698757', 'rafael.costa@email.com',     '(62) 99678-9012', 'Senador Canedo',       'GO', true),
  ('Fernanda Lima Barbosa',   '16897684600', 'fernanda.barbosa@email.com', '(62) 98789-0123', 'Trindade',             'GO', true),
  ('Thiago Rodrigues Pereira','97880932054', 'thiago.pereira@email.com',   '(64) 99890-1234', 'Catalão',              'GO', true),
  ('Camila Santos Ribeiro',   '81967273138', 'camila.ribeiro@email.com',   '(64) 98901-2345', 'Itumbiara',            'GO', true),
  ('Bruno Carvalho Mendes',   '77848648842', NULL,                         '(64) 99012-3456', 'Jataí',                'GO', true),
  ('Patrícia Gomes Araújo',   '76634400210', 'patricia.araujo@email.com',  '(61) 98112-2334', 'Luziânia',             'GO', true),
  ('Marcelo Vieira Nunes',    '97875347718', 'marcelo.nunes@email.com',    '(61) 99223-3445', 'Formosa',              'GO', true),
  ('Larissa Teixeira Moura',  '87680457190', 'larissa.moura@email.com',    '(64) 98334-4556', 'Caldas Novas',         'GO', true),
  ('Eduardo Silva Cardoso',   '78472671445', 'eduardo.cardoso@email.com',  '(62) 99445-5667', 'Pirenópolis',          'GO', false),
  ('Beatriz Correia Lopes',   '75136270101', 'beatriz.lopes@email.com',    NULL,              'Goiás',                'GO', false);

-- -----------------------------------------------------------------------------
-- Vendedores (5)
-- -----------------------------------------------------------------------------
INSERT INTO vendas.vendedor (nome, email, comissao_percentual) VALUES
  ('Carlos Eduardo Mendes',   'carlos.mendes@lojagrupo2.com.br',    5.00),
  ('Aline Cristina Prado',    'aline.prado@lojagrupo2.com.br',      4.50),
  ('Rodrigo Alves Siqueira',  'rodrigo.siqueira@lojagrupo2.com.br', 6.00),
  ('Vanessa Borges Freitas',  'vanessa.freitas@lojagrupo2.com.br',  3.50),
  ('Diego Fernandes Queiroz', 'diego.queiroz@lojagrupo2.com.br',    7.25);

-- -----------------------------------------------------------------------------
-- Produtos (20)
-- -----------------------------------------------------------------------------
INSERT INTO vendas.produto (codigo_sku, nome, descricao, preco_unitario) VALUES
  ('PRD-0001', 'Notebook 15,6" Core i5 8GB SSD 256GB',    'Notebook para uso diário, tela Full HD e Windows 11',          3499.00),
  ('PRD-0002', 'Notebook 14" Core i7 16GB SSD 512GB',     'Notebook leve para trabalho e estudos, bateria de até 10h',    5299.00),
  ('PRD-0003', 'Monitor 24" Full HD IPS',                 'Monitor com painel IPS, entradas HDMI e DisplayPort',           899.90),
  ('PRD-0004', 'Monitor 27" QHD 75Hz',                    'Monitor 2560x1440 com ajuste de altura',                       1599.00),
  ('PRD-0005', 'Mouse sem fio 1600 DPI',                  'Mouse óptico sem fio com receptor USB',                          79.90),
  ('PRD-0006', 'Teclado mecânico ABNT2',                  'Teclado mecânico com switches azuis e iluminação LED',          289.90),
  ('PRD-0007', 'Kit teclado e mouse sem fio',             'Kit sem fio com teclado ABNT2 e mouse',                         149.90),
  ('PRD-0008', 'Headset USB com microfone',               'Headset com cancelamento de ruído para reuniões',               189.90),
  ('PRD-0009', 'Webcam Full HD 1080p',                    'Webcam com microfone embutido e foco automático',               249.90),
  ('PRD-0010', 'SSD 480GB SATA III',                      'SSD 2,5" com leitura de até 550 MB/s',                          259.90),
  ('PRD-0011', 'SSD NVMe 1TB',                            'SSD M.2 NVMe com leitura de até 3500 MB/s',                     489.90),
  ('PRD-0012', 'Pendrive 64GB USB 3.0',                   NULL,                                                             39.90),
  ('PRD-0013', 'HD externo 1TB USB 3.0',                  'HD portátil para backup',                                       379.90),
  ('PRD-0014', 'Roteador Wi-Fi 6 dual band',              'Roteador AX1800 com 4 antenas',                                 449.90),
  ('PRD-0015', 'Impressora multifuncional jato de tinta', 'Imprime, copia e digitaliza, com conexão Wi-Fi',                899.00),
  ('PRD-0016', 'Cartucho de tinta preto',                 'Cartucho compatível com a impressora multifuncional',            89.90),
  ('PRD-0017', 'Cadeira de escritório ergonômica',        'Cadeira com apoio lombar e braços reguláveis',                 1199.00),
  ('PRD-0018', 'Suporte ergonômico para notebook',        'Suporte de alumínio com regulagem de altura',                   119.90),
  ('PRD-0019', 'Hub USB-C 7 em 1',                        'HDMI 4K, 3 USB 3.0, leitor de cartões e carregamento PD',       199.90),
  ('PRD-0020', 'Carregador USB-C 65W',                    NULL,                                                            159.90);

-- -----------------------------------------------------------------------------
-- Vendas (30 + as 7 combinadas com os Grupos 5 e 7) e itens
--
-- Cada venda recebe um "numero" local só para ligar os itens a ela. Os ids reais
-- são reservados na sequence da coluna identity (nextval) e gravados com
-- OVERRIDING SYSTEM VALUE, assim o script não depende de os ids começarem em 1.
-- Cliente e vendedor são localizados pelas chaves naturais (CPF e e-mail).
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_venda ON COMMIT DROP AS
SELECT nextval(pg_get_serial_sequence('vendas.venda', 'venda_id'))::integer AS venda_id, v.*
FROM (VALUES
  ( 1, '15881399803', 'carlos.mendes@lojagrupo2.com.br',    59, '09:12', 'ENTREGUE',   'PIX',            NULL),
  ( 2, '11417075350', 'aline.prado@lojagrupo2.com.br',      57, '10:45', 'ENTREGUE',   'CARTAO_CREDITO', NULL),
  ( 3, '78472671445', 'rodrigo.siqueira@lojagrupo2.com.br', 56, '14:20', 'ENTREGUE',   'BOLETO',         'Compra para o escritório da empresa do cliente'),
  ( 4, '88447294072', 'carlos.mendes@lojagrupo2.com.br',    54, '16:05', 'CANCELADA',  'CARTAO_CREDITO', 'Cancelada a pedido do cliente antes do faturamento'),
  ( 5, '69879730917', 'vanessa.freitas@lojagrupo2.com.br',  52, '11:30', 'ENTREGUE',   'DINHEIRO',       NULL),
  ( 6, '16897684600', 'diego.queiroz@lojagrupo2.com.br',    50, '15:40', 'ENTREGUE',   'CARTAO_DEBITO',  NULL),
  ( 7, '64556815177', 'rodrigo.siqueira@lojagrupo2.com.br', 47, '09:55', 'ENTREGUE',   'PIX',            NULL),
  ( 8, '81967273138', 'aline.prado@lojagrupo2.com.br',      45, '13:10', 'ENTREGUE',   'BOLETO',         NULL),
  ( 9, '55761698757', 'carlos.mendes@lojagrupo2.com.br',    43, '17:25', 'ENTREGUE',   'CARTAO_CREDITO', 'Parcelado em 10x sem juros'),
  (10, '76634400210', 'diego.queiroz@lojagrupo2.com.br',    41, '10:05', 'CANCELADA',  'BOLETO',         'Boleto não pago até o vencimento'),
  (11, '97880932054', 'vanessa.freitas@lojagrupo2.com.br',  38, '14:50', 'ENTREGUE',   'PIX',            NULL),
  (12, '97875347718', 'aline.prado@lojagrupo2.com.br',      35, '12:15', 'ENTREGUE',   'CARTAO_CREDITO', NULL),
  (13, '15881399803', 'rodrigo.siqueira@lojagrupo2.com.br', 32, '16:40', 'ENTREGUE',   'CARTAO_DEBITO',  NULL),
  (14, '87680457190', 'carlos.mendes@lojagrupo2.com.br',    29, '09:30', 'ENTREGUE',   'DINHEIRO',       NULL),
  (15, '77848648842', 'diego.queiroz@lojagrupo2.com.br',    26, '11:45', 'ENTREGUE',   'PIX',            NULL),
  (16, '11417075350', 'vanessa.freitas@lojagrupo2.com.br',  23, '15:20', 'ENTREGUE',   'CARTAO_CREDITO', NULL),
  (17, '88447294072', 'aline.prado@lojagrupo2.com.br',      20, '10:35', 'CANCELADA',  'PIX',            'Produto sem estoque no momento da separação'),
  (18, '16897684600', 'rodrigo.siqueira@lojagrupo2.com.br', 17, '13:55', 'ENTREGUE',   'BOLETO',         NULL),
  (19, '69879730917', 'carlos.mendes@lojagrupo2.com.br',    14, '16:10', 'EM_ENTREGA', 'CARTAO_CREDITO', 'Entrega agendada para o período da tarde'),
  (20, '81967273138', 'diego.queiroz@lojagrupo2.com.br',    12, '09:40', 'ENTREGUE',   'CARTAO_DEBITO',  NULL),
  (21, '64556815177', 'aline.prado@lojagrupo2.com.br',      10, '14:25', 'EM_ENTREGA', 'PIX',            NULL),
  (22, '55761698757', 'vanessa.freitas@lojagrupo2.com.br',   8, '11:05', 'EM_ENTREGA', 'DINHEIRO',       NULL),
  (23, '76634400210', 'rodrigo.siqueira@lojagrupo2.com.br',  7, '15:50', 'EM_ENTREGA', 'CARTAO_CREDITO', NULL),
  (24, '97875347718', 'carlos.mendes@lojagrupo2.com.br',     6, '10:20', 'CONFIRMADA', 'BOLETO',         NULL),
  (25, '97880932054', 'diego.queiroz@lojagrupo2.com.br',     5, '17:35', 'CONFIRMADA', 'PIX',            NULL),
  (26, '87680457190', 'aline.prado@lojagrupo2.com.br',       4, '12:45', 'CONFIRMADA', 'CARTAO_DEBITO',  NULL),
  (27, '15881399803', 'rodrigo.siqueira@lojagrupo2.com.br',  3, '09:05', 'CANCELADA',  'CARTAO_CREDITO', 'Pagamento recusado pela operadora do cartão'),
  (28, '77848648842', 'vanessa.freitas@lojagrupo2.com.br',   3, '16:30', 'ABERTA',     'BOLETO',         'Aguardando compensação do boleto'),
  (29, '88447294072', 'carlos.mendes@lojagrupo2.com.br',     2, '11:15', 'ABERTA',     'CARTAO_CREDITO', NULL),
  (30, '11417075350', 'diego.queiroz@lojagrupo2.com.br',     1, '14:00', 'ABERTA',     'PIX',            NULL)
) AS v(numero, cpf, vendedor_email, dias_atras, hora, status, forma_pagamento, observacao);

-- Vendas 101 a 107, combinadas com os Grupos 5 e 7: o num_venda das entregas do
-- Grupo 7 é o código do pedido no Grupo 5, e os três grupos usam 101 a 107.
-- Número explícito (a sequence é ajustada no fim do script), status CONFIRMADA
-- e data fixa em 19/10/2026: com data relativa, numa carga feita dias depois a
-- venda ficaria posterior às entregas de 20 a 22/10 do Grupo 7. O dias_atras é
-- calculado para cair nessa data.
INSERT INTO tmp_venda (venda_id, numero, cpf, vendedor_email, dias_atras, hora, status, forma_pagamento, observacao)
SELECT v.numero, v.numero, v.cpf, v.vendedor_email, current_date - date '2026-10-19', v.hora, 'CONFIRMADA', v.forma_pagamento, v.observacao
FROM (VALUES
  (101, '88447294072', 'carlos.mendes@lojagrupo2.com.br',    '09:10', 'PIX',            'Venda combinada com os Grupos 5 e 7 (teste de integração)'),
  (102, '11417075350', 'aline.prado@lojagrupo2.com.br',      '09:40', 'CARTAO_CREDITO', 'Venda combinada com os Grupos 5 e 7 (teste de integração)'),
  (103, '69879730917', 'rodrigo.siqueira@lojagrupo2.com.br', '10:15', 'BOLETO',         'Venda combinada com os Grupos 5 e 7 (teste de integração)'),
  (104, '76634400210', 'vanessa.freitas@lojagrupo2.com.br',  '11:00', 'CARTAO_DEBITO',  'Venda combinada com os Grupos 5 e 7 (teste de integração)'),
  (105, '81967273138', 'diego.queiroz@lojagrupo2.com.br',    '13:30', 'PIX',            'Venda combinada com os Grupos 5 e 7 (teste de integração)'),
  (106, '97875347718', 'carlos.mendes@lojagrupo2.com.br',    '14:20', 'DINHEIRO',       'Venda combinada com os Grupos 5 e 7 (teste de integração)'),
  (107, '64556815177', 'aline.prado@lojagrupo2.com.br',      '15:05', 'CARTAO_CREDITO', 'Venda combinada com os Grupos 5 e 7 (teste de integração)')
) AS v(numero, cpf, vendedor_email, hora, forma_pagamento, observacao);

-- Todas as vendas nascem ABERTAS (default da coluna status): a trigger
-- trg_item_venda_exigir_venda_aberta só aceita itens em venda ABERTA. O status
-- final de cada venda é aplicado depois dos itens, no fim do script.
INSERT INTO vendas.venda (venda_id, cliente_id, vendedor_id, data_venda, forma_pagamento, observacao)
OVERRIDING SYSTEM VALUE
SELECT t.venda_id,
       c.cliente_id,
       vd.vendedor_id,
       ((current_date - t.dias_atras) + t.hora::time) AT TIME ZONE 'America/Sao_Paulo',
       t.forma_pagamento,
       t.observacao
FROM tmp_venda t
JOIN vendas.cliente  c  ON c.cpf = t.cpf
JOIN vendas.vendedor vd ON vd.email = t.vendedor_email
ORDER BY t.numero;

-- Itens: (numero da venda, SKU, quantidade). O preço vem do cadastro do produto.
CREATE TEMP TABLE tmp_item ON COMMIT DROP AS
SELECT * FROM (VALUES
  ( 1, 'PRD-0001', 1), ( 1, 'PRD-0005', 1),
  ( 2, 'PRD-0003', 2), ( 2, 'PRD-0006', 1),
  ( 3, 'PRD-0017', 4), ( 3, 'PRD-0018', 4),
  ( 4, 'PRD-0002', 1),
  ( 5, 'PRD-0012', 3),
  ( 6, 'PRD-0015', 1), ( 6, 'PRD-0016', 2),
  ( 7, 'PRD-0010', 1), ( 7, 'PRD-0012', 2), ( 7, 'PRD-0020', 1),
  ( 8, 'PRD-0004', 1), ( 8, 'PRD-0009', 1), ( 8, 'PRD-0008', 1),
  ( 9, 'PRD-0001', 1), ( 9, 'PRD-0007', 1), ( 9, 'PRD-0013', 1), ( 9, 'PRD-0019', 1),
  (10, 'PRD-0011', 2),
  (11, 'PRD-0014', 1),
  (12, 'PRD-0003', 1), (12, 'PRD-0007', 1),
  (13, 'PRD-0008', 1), (13, 'PRD-0020', 1),
  (14, 'PRD-0005', 2), (14, 'PRD-0012', 5),
  (15, 'PRD-0002', 1), (15, 'PRD-0018', 1), (15, 'PRD-0019', 1),
  (16, 'PRD-0016', 3),
  (17, 'PRD-0017', 2),
  (18, 'PRD-0006', 1), (18, 'PRD-0005', 1), (18, 'PRD-0008', 1),
  (19, 'PRD-0001', 2), (19, 'PRD-0003', 2), (19, 'PRD-0007', 2), (19, 'PRD-0014', 1),
  (20, 'PRD-0013', 1),
  (21, 'PRD-0009', 1), (21, 'PRD-0008', 1),
  (22, 'PRD-0010', 2),
  (23, 'PRD-0004', 1), (23, 'PRD-0018', 1),
  (24, 'PRD-0015', 1),
  (25, 'PRD-0011', 1), (25, 'PRD-0019', 1),
  (26, 'PRD-0020', 2), (26, 'PRD-0012', 2),
  (27, 'PRD-0002', 1), (27, 'PRD-0004', 1),
  (28, 'PRD-0017', 1),
  (29, 'PRD-0006', 1), (29, 'PRD-0007', 1),
  (30, 'PRD-0003', 1), (30, 'PRD-0005', 1), (30, 'PRD-0009', 1),
  (101, 'PRD-0002', 1), (101, 'PRD-0005', 1),
  (102, 'PRD-0004', 2),
  (103, 'PRD-0011', 1), (103, 'PRD-0019', 1),
  (104, 'PRD-0015', 1), (104, 'PRD-0016', 3),
  (105, 'PRD-0001', 1), (105, 'PRD-0008', 1),
  (106, 'PRD-0017', 2),
  (107, 'PRD-0014', 1), (107, 'PRD-0010', 2)
) AS i(numero, sku, quantidade);

INSERT INTO vendas.item_venda (venda_id, produto_id, quantidade, preco_unitario)
SELECT t.venda_id, p.produto_id, i.quantidade, p.preco_unitario
FROM tmp_item i
JOIN tmp_venda      t ON t.numero = i.numero
JOIN vendas.produto p ON p.codigo_sku = i.sku;

-- Com os itens gravados, cada venda segue as transições permitidas até o status
-- final (a trigger trg_venda_transicao_status não deixa pular etapas):
--   ABERTA → CONFIRMADA → EM_ENTREGA → ENTREGUE, e ABERTA → CANCELADA
UPDATE vendas.venda v SET status = 'CONFIRMADA'
  FROM tmp_venda t WHERE v.venda_id = t.venda_id AND t.status IN ('CONFIRMADA', 'EM_ENTREGA', 'ENTREGUE');
UPDATE vendas.venda v SET status = 'EM_ENTREGA'
  FROM tmp_venda t WHERE v.venda_id = t.venda_id AND t.status IN ('EM_ENTREGA', 'ENTREGUE');
UPDATE vendas.venda v SET status = 'ENTREGUE'
  FROM tmp_venda t WHERE v.venda_id = t.venda_id AND t.status = 'ENTREGUE';
UPDATE vendas.venda v SET status = 'CANCELADA'
  FROM tmp_venda t WHERE v.venda_id = t.venda_id AND t.status = 'CANCELADA';

-- Os JOINs acima descartariam em silêncio uma linha com CPF, e-mail ou SKU
-- digitado errado; aqui a carga falha (e é desfeita) se isso acontecer.
DO $$
BEGIN
  IF (SELECT count(*) FROM vendas.venda) <> (SELECT count(*) FROM tmp_venda) THEN
    RAISE EXCEPTION 'Vendas não carregadas: verifique CPF/e-mail em tmp_venda';
  END IF;
  IF (SELECT count(*) FROM vendas.item_venda) <> (SELECT count(*) FROM tmp_item) THEN
    RAISE EXCEPTION 'Itens não carregados: verifique numero/SKU em tmp_item';
  END IF;
END;
$$;

-- As vendas 101 a 107 entraram com número explícito: a sequence passa para o
-- maior número, e a próxima venda criada na aplicação é a 108
SELECT setval(pg_get_serial_sequence('vendas.venda', 'venda_id'), (SELECT max(venda_id) FROM vendas.venda));

COMMIT;
