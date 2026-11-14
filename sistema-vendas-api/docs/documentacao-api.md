# Documentação da API de Vendas (Grupo 2)

Referência interativa: **`/docs`** (Swagger UI); especificação OpenAPI em `/openapi.json`.
Contrato: [`contrato-vendas-estoque-g4.md`](contrato-vendas-estoque-g4.md) (o que fornecemos ao G4, com rotas, JSON e códigos de resposta). O que consumimos do G7 segue o contrato do G7 (mantido fora do repositório, porque contém a chave de acesso) e o OpenAPI deles (https://grupo7-apirest.ioshuavps.com.br/docs).

## Rotas
| Método | Rota | Perfil mínimo |
|---|---|---|
| GET | `/health` | público |
| GET | `/docs`, `/openapi.json` | público |
| GET | `/api/v1/vendas?status=&data_inicio=&data_fim=`, `/api/v1/vendas/{id}` | leitura |
| POST/PUT/DELETE | `/api/v1/vendas`, `/api/v1/vendas/{id}` | admin |
| GET | `/api/v1/vendas/{id}/entrega` (consulta a entrega no G7) | admin |
| GET | `/api/v1/integracao/logs?direcao=ENTRADA\|SAIDA&limite=50` | admin |

Chaves padrão (`API_KEYS`): `vendas-admin-key:admin` (uso interno) e `estoque-key:leitura` (G4). Toda resposta traz `X-Request-Id` (o recebido ou um UUID novo), usado para correlacionar os logs.

## Exemplos (curl)
```bash
# Como o G4 usa a API
G4='X-API-Key: estoque-key'
curl -H "$G4" 'localhost:3001/api/v1/vendas?status=CONFIRMADA'   # vendas a baixar
curl -H "$G4" 'localhost:3001/api/v1/vendas?status=CANCELADA'    # vendas a estornar
curl -H "$G4" localhost:3001/api/v1/vendas/101

# Operações internas do G2
H='X-API-Key: vendas-admin-key'
curl -X POST -H "$H" -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-1' \
  -d '{"cliente":{"nome":"Ana Lima","documento":"52998224725"},"entrega":{"endereco":"Rua A, 1","cidade":"Recife","uf":"PE","cep":"50000000"},"itens":[{"produto_id":103,"nome_produto":"Mouse Optico","quantidade":2,"preco_unitario":89.9}]}' \
  localhost:3001/api/v1/vendas
curl -H "$H" localhost:3001/api/v1/vendas/101/entrega   # entrega da venda no G7
curl -X PUT -H "$H" -H 'Content-Type: application/json' \
  -d '{"cliente":{"nome":"Ana Lima","documento":"52998224725"},"entrega":{"endereco":"Rua A, 1","cidade":"Recife","uf":"PE","cep":"50000000"},"status":"CANCELADA"}' \
  localhost:3001/api/v1/vendas/101
curl -X DELETE -H "$H" localhost:3001/api/v1/vendas/101
curl -H "$H" 'localhost:3001/api/v1/integracao/logs?direcao=ENTRADA&limite=10'
```

## Ciclo de vida da venda
| Operação | Resultado | O que o G4 vê |
|---|---|---|
| `POST /vendas` | venda gravada como `CONFIRMADA` | aparece em `?status=CONFIRMADA`: dar baixa |
| `PUT` com `status=CANCELADA` | venda `CANCELADA`, `motivo_cancelamento = "cancelada via API"` | aparece em `?status=CANCELADA`: estornar, se já tinha baixado |
| `PUT` em venda `CANCELADA` | 409 `VENDA_CANCELADA` | — |
| `DELETE` de venda `CONFIRMADA` | 409 `VENDA_CONFIRMADA` | — |
| `DELETE` de venda `CANCELADA` | 204 | `GET /vendas/{id}` passa a dar 404: tratar como cancelada |

## Consumo da API de Entregas (G7)
`GET /api/v1/vendas/{id}/entrega` (perfil admin; na tela, botão **Consultar entrega (G7)** em cada venda) faz:
1. `GET /entregas?id_pedido={id}&tamanho=100` no G7. O `id_pedido` do G7 é o número da venda do G2. Se houver mais de uma entrega, vale a que não está `CANCELADA`.
2. Se houver entrega, `GET /entregas/{id_entrega}/historico`.
3. Valida as duas respostas contra o contrato do G7 (`entregasClient.ts`):
   - campos obrigatórios e tipos;
   - `status_entrega` dentro do enum;
   - `id_pedido` igual ao da venda;
   - `transportadora`, `data_prevista`, `valor_frete`, `endereco_destino.numero` e `endereco_destino.bairro` nulos só com `pendencias`;
   - `data_entrega` presente quando `ENTREGUE`;
   - no máximo uma entrega não cancelada por venda.

   Campos novos são ignorados.
4. Se tudo for válido, grava na venda (tabela `entregas_venda`) o `id_entrega`, o `codigo_rastreio`, o `status_entrega` e a `data_atualizacao` do G7. Fora do contrato, nada é gravado.
5. Responde com a entrega, o histórico, a leitura anterior e `alterada`, que indica se a `data_atualizacao` mudou desde a última consulta.

| Resposta | Quando |
|---|---|
| 200 com `entrega` preenchida | entrega encontrada e válida |
| 200 com `entrega: null` | o pedido ainda não gerou entrega no G7 (ex.: venda 108) |
| 404 `VENDA_NAO_ENCONTRADA` | venda inexistente no G2 (o G7 nem é chamado) |
| 502 `ENTREGAS_CONTRATO_INVALIDO` | resposta 200 fora do contrato; os campos com problema vêm em `detalhes` |
| 502 `ENTREGAS_RESPOSTA_INVALIDA` | corpo que não é JSON |
| 502 `ENTREGAS_AUTENTICACAO` | G7 recusou a chave (401/403) |
| 502 `ENTREGAS_RESPOSTA_INESPERADA` | status não previsto (ex.: 400, 404) |
| 503 `ENTREGAS_INDISPONIVEL` / `ENTREGAS_ERRO_INTERNO` | G7 fora do ar, lento ou com 5xx depois das novas tentativas (`ERRO_INTERNO` quando a última resposta foi 500) |

Cada chamada ao G7 (`clienteHttp.ts`) segue as regras do contrato do G7:
- timeout de 5 s;
- até 3 novas tentativas (1 s, 2 s e 4 s) em falha de rede, timeout ou 5xx;
- no 503, espera o `Retry-After`; acima de 10 s, desiste e responde 503;
- headers `X-API-Key`, `X-Request-Id` em UUID v4 e `X-Sistema-Origem: vendas-g2`;
- registro em `integracao_logs` (direção `SAIDA`, sistema `entregas-g7`), com a mesma correlação da requisição que originou a chamada.

## Testes
`npm test` roda os testes por HTTP (`services/vendas-api/test/`):
- **Contrato com o G4:** autenticação, cada rota, filtros, validações, tabela de status, formato do JSON e dos erros, e o log das chamadas recebidas.
- **Cliente HTTP:** timeout, novas tentativas em 5xx, `Retry-After`, rede fora e resposta inválida.
- **Consumo do G7:** feito contra um G7 simulado com os corpos reais do ambiente de testes deles. Cobre entrega normal, sem entrega, com pendências, várias quebras de contrato, campos novos e falhas.

## Variáveis de ambiente
| Variável | Padrão |
|---|---|
| `PORT` | 3001 |
| `DB_PATH` | `services/vendas-api/vendas.db` |
| `API_KEYS` | `vendas-admin-key:admin,estoque-key:leitura` |
| `ENTREGAS_URL` | `https://grupo7-apirest.ioshuavps.com.br/api/v1` |
| `ENTREGAS_API_KEY` | vazio: preencher no `.env` com a chave do contrato do G7 |
| `ENTREGAS_TIMEOUT_MS` | 5000 |
