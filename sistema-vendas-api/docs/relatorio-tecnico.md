# Relatório técnico — Sistema de Vendas (Grupo 2)

## 1. Arquitetura
Na cadeia do enunciado, a seta indica quem produz para quem: **G7 → G2** e **G2 → G4**.
```
API de Entregas (G7) ──HTTP/JSON──▶ Vendas (G2) ──HTTP/JSON──▶ Estoque (G4)
   fornecedor            G2 consome     │     G2 fornece        consumidor
                                        │
                                  SQLite (vendas.db)
```
Papéis: **consumidor** da API do G7 e **fornecedor** da API de Vendas para o G4. Comunicação exclusivamente via HTTP, sem acesso a banco de terceiros. O lado do G4 segue `contrato-vendas-estoque-g4.md`, e o lado do G7 segue `contrato-vendas-entregas-g7.md` e o OpenAPI publicado por eles.

## 2. Tecnologias
- API: Node 24 + TypeScript (executado direto pelo Node, sem etapa de build), Express 5, SQLite (`node:sqlite`), zod, swagger-ui-express.
- Tela: React 19 + Vite.
- Testes: `node:test`, por HTTP, com banco em memória.
- Deploy: Docker (API em Node, tela servida por nginx, que repassa `/api` para a API).

Execução: `npm run dev` (ou `npm run api` + `npm run web`); testes com `npm test`.

## 3. Estrutura
- `services/vendas-api/src/` — app, rotas, serviço de vendas, consumidor do G7 (`entregasClient.ts`, `entregasService.ts`, sobre o `clienteHttp.ts`), autenticação, logs, OpenAPI.
- `services/vendas-api/db/` — `schema.sql`.
- `services/vendas-api/test/` — testes da API (contrato com o G4), do cliente HTTP e do consumo do G7.
- `src/` — tela (vendas com a entrega de cada uma no G7, nova venda, painel de integração).

## 4. Decisões técnicas
- **Inversão da cadeia.** A primeira versão lia a seta como "quem consome quem" (G2 consumia o Estoque do G4 e fornecia para o G7). Depois da correção do professor (a seta é "quem produz para quem"), o G2 passou a fornecer para o G4 e a consumir do G7. O cliente do Estoque saiu do projeto, e a sua parte genérica (timeout, retry, log) virou `clienteHttp.ts`, base do consumidor do G7.
- **Nome e preço no pedido.** Sem consultar o Estoque, o nome e o preço de cada item vêm no `POST /vendas`. O G2 valida (preço > 0, até 2 casas) e calcula subtotais e total. O `produto_id` é o código do G4, combinado no contrato.
- **Venda nasce `CONFIRMADA`.** Não há chamada externa no registro, então não existe estado intermediário. O G4 baixa as vendas `CONFIRMADA` e estorna as `CANCELADA`.
- **Exclusão só de venda cancelada.** Excluir uma venda confirmada faria o G4 perder o aviso de estorno. Se uma venda já baixada for cancelada e excluída antes de o G4 ver, o 404 indica ao G4 que deve estornar (contrato, seção 6).
- **Ids nunca reutilizados** (`AUTOINCREMENT`): o G4 controla o que já processou pelo `id` da venda.
- Separação entre erro de formato (400 `FORMATO_INVALIDO`, campos em `detalhes`) e de regra de negócio (422 `DADOS_INVALIDOS`).
- Idempotência do `POST` por `Idempotency-Key` com índice único (protege também contra concorrência).
- **Vendas começam no 101.** O ambiente de testes do G7 tem entregas para as vendas 101 a 117. Iniciar a sequência em 101 (só em banco novo) faz cada venda criada cair num cenário do G7, sem dados fictícios no G2.
- **Consumo do G7 sob demanda.** A entrega é consultada quando alguém abre a venda (`GET /vendas/{id}/entrega`), não em lote: o G7 só tem chave de leitura para o G2, e a consulta mostra o estado atual. A rota é só do perfil admin, então o G4 não a usa.
- **Validação estrita do que importa e tolerância ao resto.** São conferidos os campos obrigatórios, os tipos, o enum de status, o `id_pedido` e os nulos só com `pendencias`, e campos novos são ignorados (regras 3, 4 e 7 do contrato do G7). A venda só é atualizada depois de todas as respostas passarem.
- **Rastreio guardado na venda** (tabela `entregas_venda`, 1 linha por venda): `id_entrega`, `codigo_rastreio`, `status_entrega` e a `data_atualizacao` do G7, comparada a cada leitura para saber se a entrega mudou (regras 5 e 6).
- Consumidor (`clienteHttp.ts`): timeout de 5 s e até 3 novas tentativas (1 s, 2 s, 4 s) em falha de rede, timeout ou 5xx, respeitando o `Retry-After` (regras 2 e 6 do contrato do G7). `X-Request-Id` em UUID v4, igual ao id de correlação do log. Resposta fora do contrato é recusada e marcada no log.
- Autenticação por `X-API-Key` com perfis `admin` e `leitura`; a autenticação é checada antes de ler o corpo.
- Versionamento na URL (`/api/v1`); logs de entrada e saída com `X-Request-Id` de correlação; chamadas com a chave do G4 aparecem no log como `estoque-g4`.

## 5. Conceitos da seção 15
Cobertos: REST, provider/consumer, comunicação síncrona, HTTP e métodos, endpoints, JSON, contrato, status codes, autenticação/autorização, validação, tratamento de erros, timeout/retry, idempotência, versionamento, interoperabilidade, persistência, logs e rastreabilidade.

## 6. Dificuldades encontradas
- **Leitura da cadeia de integração.** A legenda "sequência de consumo" levou a ler `G2 → G4` como "G2 consome G4". O professor corrigiu para "G2 produz para G4", o que inverteu os dois papéis do G2 e exigiu refazer os contratos.
- **Imagem Docker da tela.** Sem `.dockerignore`, o `node_modules` da máquina (binários nativos para glibc) era copiado por cima do instalado no Alpine. Resolvido com o `.dockerignore`.
- **Formato do `X-Request-Id`.** O G7 descarta ids que não são UUID e gera outro, o que quebraria a correlação entre o log do G2 e o do G7. O G2 passou a enviar sempre UUID v4.
- **Entregas importadas do G5 com campos nulos.** No G7, uma entrega criada a partir de um pedido do G5 nasce sem transportadora, previsão e frete. Validar esses campos como obrigatórios recusaria entregas legítimas. A regra ficou: nulo só é aceito com `pendencias` preenchida.
- _Completar após a apresentação (rede, situações recebidas por e-mail etc.)._

## 7. Evidências
- [`evidencias-testes.txt`](evidencias-testes.txt): saída do `npm test`. Para atualizar, rode `npm test` de novo.
- Consumo real do G7 (13/11/2026): vendas 101 a 117 consultadas no ambiente de testes do G7, com 35 chamadas e nenhum erro. As 16 entregas e a venda 108 sem entrega bateram com a tabela do contrato do G7.
- _Anexar prints do Swagger/curl, da aba **Integração** e da consulta a `integracao_logs` com o G4 e o G7 reais._
