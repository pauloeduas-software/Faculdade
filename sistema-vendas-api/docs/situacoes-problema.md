# Tratamento das situações-problema

Pela seção 10 do enunciado, o fornecedor introduz os problemas na própria API e o consumidor precisa identificá-los e tratá-los. O G2 participa dos dois lados:
- **Como fornecedor (G2 → G4):** o G2 introduz na API de Vendas os problemas recebidos por e-mail, e o G4 precisa detectá-los.
- **Como consumidor (G7 → G2):** o G7 introduz problemas na API de Entregas, e o G2 precisa detectá-los.

## A) Como fornecedor para o G4
O comportamento normal da API está no contrato (`contrato-vendas-estoque-g4.md`) e é testado em `services/vendas-api/test/api.test.ts` (`npm test`). Toda requisição do G4 fica registrada em `integracao_logs` como `estoque-g4` (aba **Integração** da tela ou `GET /api/v1/integracao/logs?direcao=ENTRADA`), o que permite mostrar na apresentação o que o G4 recebeu em cada caso.

As situações que o G2 vai aplicar chegam por e-mail. Pela regra 6, o G4 não recebe a lista antes.

## B) Como consumidor do G7
O G2 consulta a entrega de cada venda em `GET /entregas?id_pedido={venda}` e o histórico dela. As regras de tratamento vêm do contrato do G7 (`contrato-vendas-entregas-g7.md`, seções 6 e 7). Os casos estão testados em `services/vendas-api/test/entregas.test.ts` e `clienteHttp.test.ts`.

| Problema do G7 | Detecção | Resultado no G2 |
|---|---|---|
| Campo obrigatório ausente ou renomeado, ou tipo errado (ex.: `valor_frete` como texto) | validação do contrato do G7 | 502 `ENTREGAS_CONTRATO_INVALIDO` com os campos em `detalhes`; a chamada fica marcada "fora do contrato" no log e a venda não é alterada |
| `status_entrega` fora do enum | validação | idem |
| Entrega de outra venda (`id_pedido` diferente do consultado) | comparação com a venda | idem |
| `transportadora`, `data_prevista`, `valor_frete`, `numero` ou `bairro` nulos sem `pendencias` | regra 4 do contrato do G7 | idem; com `pendencias`, os nulos são normais |
| `ENTREGUE` sem `data_entrega`; duas entregas não canceladas para a mesma venda | regras do contrato do G7 | idem |
| Campo novo na resposta | — | ignorado (regra 7), sem erro |
| Corpo que não é JSON (ex.: página HTML com 200) | falha no parse | 502 `ENTREGAS_RESPOSTA_INVALIDA`, sem nova tentativa |
| 401/403 (chave trocada ou revogada) | status | 502 `ENTREGAS_AUTENTICACAO` |
| Endpoint alterado ou status não previsto (400, 404) | status + `erro.codigo` do G7 | 502 `ENTREGAS_RESPOSTA_INESPERADA` |
| 500 | status | até 3 novas tentativas (1 s, 2 s, 4 s); se persistir, 503 `ENTREGAS_ERRO_INTERNO` |
| 503, outro 5xx, lentidão acima de 5 s, G7 fora do ar | status, timeout ou falha de rede | até 3 novas tentativas, respeitando o `Retry-After` do 503 (acima de 10 s, desiste na hora); se persistir, 503 `ENTREGAS_INDISPONIVEL`. Um 503 passageiro é superado na nova tentativa |

Em nenhum caso a API do G2 cai: o erro volta como resposta HTTP com `erro.codigo`, a tela mostra o código e a mensagem, e cada tentativa fica no log com o mesmo id de correlação. O `X-Request-Id` enviado ao G7 é esse mesmo id, que serve para o G7 achar a chamada do lado dele (seção 9 do contrato do G7).

## C) Registro das situações recebidas por e-mail
| # | Situação recebida | Quem aplicou | Como identificamos | Como tratamos |
|---|---|---|---|---|
| 1 | _preencher_ | | | |
