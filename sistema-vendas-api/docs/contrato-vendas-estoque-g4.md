# Contrato de Integração REST — API de Vendas (Grupo 2) → Estoque (Grupo 4)

Acordo técnico entre o **Grupo 2 (Vendas)**, fornecedor da API, e o **Grupo 4 (Estoque)**, consumidor. O Grupo 4 consulta as vendas para dar baixa no estoque dos produtos vendidos e para devolver ao estoque os itens das vendas canceladas.

## 1. Identificação da API
| Item | Valor |
|---|---|
| Nome | API de Vendas |
| Finalidade | Registrar e consultar vendas; informar ao sistema de Estoque os produtos e as quantidades de cada venda e quais vendas foram canceladas |
| Sistema fornecedor | Grupo 2 — Vendas |
| Sistema consumidor | Grupo 4 — Estoque |
| URL-base | `https://<endereço-do-túnel-do-G2>/api/v1`, publicada pelo Cloudflare Tunnel; o G2 informa o endereço no dia do teste (em ambiente local: `http://localhost:3001/api/v1`) |
| Formato | `application/json` (UTF-8) |
| Versão | 1.0 (a versão faz parte da URL: `/api/v1`) |
| Comunicação | Síncrona, HTTP |
| Documentação interativa | `GET /docs` (Swagger) · especificação OpenAPI em `GET /openapi.json` |
| Verificação de saúde | `GET /health` (sem autenticação) → `200 {"status":"ok","servico":"vendas-g2","versao":"1.0"}` |

## 2. Autenticação e autorização
Todas as rotas em `/api/v1` exigem o header `X-API-Key`.

| Chave | Perfil | Pode usar |
|---|---|---|
| `estoque-key` | leitura | Somente `GET` (chave entregue ao Grupo 4) |
| `vendas-admin-key` | admin | Todos os métodos (uso interno do Grupo 2) |

- Sem o header → **401** `NAO_AUTENTICADO`.
- Chave desconhecida → **401** `CHAVE_INVALIDA`.
- Chave de leitura em `POST`, `PUT` ou `DELETE` → **403** `SEM_PERMISSAO`.

## 3. Endpoints
| Método | Endpoint | Finalidade | Sucesso | Erros possíveis |
|---|---|---|---|---|
| GET | `/vendas` | Listar vendas, com filtros opcionais | 200 | 400, 401, 500 |
| GET | `/vendas/{id}` | Consultar uma venda | 200 | 400, 401, 404, 500 |
| POST | `/vendas` | Registrar venda | 201 (200 em reenvio idempotente) | 400, 401, 403, 422, 500 |
| PUT | `/vendas/{id}` | Atualizar dados de cliente/entrega ou cancelar a venda | 200 | 400, 401, 403, 404, 409, 422, 500 |
| DELETE | `/vendas/{id}` | Excluir venda cancelada | 204 | 400, 401, 403, 404, 409, 500 |

**Uso pelo Grupo 4:**
- `GET /vendas?status=CONFIRMADA`: vendas cujos itens devem ser baixados do estoque.
- `GET /vendas?status=CANCELADA`: vendas canceladas, cujos itens já baixados devem voltar ao estoque.
- `GET /vendas/{id}`: consultar uma venda específica.

O campo `id` da venda é o identificador que o Grupo 4 deve guardar para saber quais vendas já processou.

### 3.1 GET /vendas
Parâmetros de consulta (todos opcionais, podem ser combinados):

| Parâmetro | Tipo | Regra | Exemplo |
|---|---|---|---|
| `status` | string | `CONFIRMADA` ou `CANCELADA` | `?status=CONFIRMADA` |
| `data_inicio` | data ISO | vendas criadas a partir desta data/hora | `?data_inicio=2026-11-01` |
| `data_fim` | data ISO | vendas criadas até esta data; com `AAAA-MM-DD` inclui o dia inteiro | `?data_fim=2026-11-30` |

Resposta **200**: lista de [Venda](#41-venda-resposta) ordenada por `id` crescente (lista vazia `[]` se não houver vendas). Filtro inválido → **400** `PARAMETRO_INVALIDO`.

### 3.2 GET /vendas/{id}
`id` inteiro positivo. Resposta **200**: uma [Venda](#41-venda-resposta).
`id` que não é inteiro positivo → **400** `ID_INVALIDO`; venda inexistente → **404** `VENDA_NAO_ENCONTRADA`.

### 3.3 POST /vendas
Uso interno do G2 (chave admin). Headers: `Content-Type: application/json` (obrigatório) e `Idempotency-Key` (opcional, recomendado).
Corpo: ver [4.2](#42-post-vendas-requisição). Resposta **201** com a venda criada e header `Location: /api/v1/vendas/{id}`.

Processamento:
1. Valida o formato (→ 400) e as regras de negócio (→ 422).
2. Grava a venda e os itens no banco do G2, na mesma transação, com `status = CONFIRMADA`. O G2 calcula o `subtotal` de cada item e o `valor_total`.

**Idempotência:** se o mesmo `Idempotency-Key` for reenviado, a API devolve a venda já criada com **200** e header `Idempotent-Replayed: true`, sem criar outra venda.

### 3.4 PUT /vendas/{id}
Uso interno do G2 (chave admin). Headers: `Content-Type: application/json`. Corpo: ver [4.3](#43-put-vendasid-requisição). Resposta **200** com a venda atualizada.

Regras de status:
| Status atual | Status pedido | Resultado |
|---|---|---|
| `CONFIRMADA` | `CONFIRMADA` ou omitido | atualiza cliente/entrega |
| `CONFIRMADA` | `CANCELADA` | cancela a venda (o G4 passa a vê-la em `?status=CANCELADA`) |
| `CANCELADA` | qualquer | **409** `VENDA_CANCELADA` |

Ao cancelar, `motivo_cancelamento` recebe `"cancelada via API"`. Uma venda cancelada não volta a ser confirmada.

### 3.5 DELETE /vendas/{id}
Uso interno do G2 (chave admin). Resposta **204** sem corpo. Remove a venda e seus itens.
Só vendas `CANCELADA` podem ser excluídas. Venda `CONFIRMADA` → **409** `VENDA_CONFIRMADA` (cancele antes com `PUT`).

## 4. Estrutura dos dados JSON

### 4.1 Venda (resposta)
Usada em `GET /vendas` (lista), `GET /vendas/{id}`, `POST /vendas` e `PUT /vendas/{id}`.
```json
{
  "id": 3,
  "cliente": { "nome": "Ana Clara Ribeiro", "documento": "52998224725" },
  "entrega": { "endereco": "Rua Augusta, 1520, ap. 34", "cidade": "São Paulo", "uf": "SP", "cep": "01304001" },
  "itens": [
    { "produto_id": 101, "nome_produto": "Teclado Mecanico", "quantidade": 1, "preco_unitario": 250.9, "subtotal": 250.9 },
    { "produto_id": 103, "nome_produto": "Mouse Optico", "quantidade": 2, "preco_unitario": 89.9, "subtotal": 179.8 }
  ],
  "valor_total": 430.7,
  "status": "CONFIRMADA",
  "motivo_cancelamento": null,
  "criado_em": "2026-11-13T14:39:45.666Z",
  "atualizado_em": "2026-11-13T14:39:45.666Z"
}
```
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | inteiro | Identificador da venda, gerado pelo G2. Nunca é reutilizado |
| `cliente.nome` | string | Nome do cliente |
| `cliente.documento` | string | CPF (11) ou CNPJ (14), somente dígitos |
| `entrega.endereco` | string | Logradouro, número e complemento |
| `entrega.cidade` | string | Cidade |
| `entrega.uf` | string | Sigla da UF, maiúscula |
| `entrega.cep` | string | 8 dígitos, sem traço |
| `itens[].produto_id` | inteiro | Código do produto no Estoque (G4) |
| `itens[].nome_produto` | string | Nome do produto |
| `itens[].quantidade` | inteiro | Quantidade vendida (a baixar no estoque) |
| `itens[].preco_unitario` | número | Preço unitário praticado na venda |
| `itens[].subtotal` | número | `quantidade × preco_unitario`, 2 casas decimais |
| `valor_total` | número | Soma dos subtotais, 2 casas decimais |
| `status` | string | `CONFIRMADA` ou `CANCELADA` |
| `motivo_cancelamento` | string ou `null` | Preenchido apenas quando `status = CANCELADA` |
| `criado_em` / `atualizado_em` | string | Data e hora ISO 8601 em UTC. `atualizado_em` muda a cada alteração, inclusive no cancelamento |

### 4.2 POST /vendas (requisição)
```json
{
  "cliente": { "nome": "Ana Clara Ribeiro", "documento": "52998224725" },
  "entrega": { "endereco": "Rua Augusta, 1520, ap. 34", "cidade": "São Paulo", "uf": "SP", "cep": "01304001" },
  "itens": [
    { "produto_id": 101, "nome_produto": "Teclado Mecanico", "quantidade": 1, "preco_unitario": 250.9 },
    { "produto_id": 103, "nome_produto": "Mouse Optico", "quantidade": 2, "preco_unitario": 89.9 }
  ]
}
```
| Campo | Tipo | Obrigatório | Regra (violação → 422) |
|---|---|---|---|
| `cliente.nome` | string | sim | ao menos 2 caracteres |
| `cliente.documento` | string | sim | 11 ou 14 dígitos (pontuação é aceita e removida) |
| `entrega.endereco` | string | sim | não vazio |
| `entrega.cidade` | string | sim | não vazia |
| `entrega.uf` | string | sim | UF brasileira válida (maiúscula ou minúscula) |
| `entrega.cep` | string | sim | 8 dígitos (traço é aceito e removido) |
| `itens` | lista | sim | ao menos 1 item |
| `itens[].produto_id` | inteiro | sim | > 0, sem repetir produto na mesma venda |
| `itens[].nome_produto` | string | sim | não vazio |
| `itens[].quantidade` | inteiro | sim | > 0 |
| `itens[].preco_unitario` | número | sim | > 0, no máximo 2 casas decimais |

Campo ausente, tipo errado (ex.: `"quantidade": "2"`) ou campo não previsto no contrato → **400** `FORMATO_INVALIDO`. `subtotal`, `valor_total` e `status` **não** são enviados: são calculados pelo G2.

### 4.3 PUT /vendas/{id} (requisição)
```json
{
  "cliente": { "nome": "Ana Clara Ribeiro", "documento": "52998224725" },
  "entrega": { "endereco": "Rua Augusta, 1600", "cidade": "São Paulo", "uf": "SP", "cep": "01304001" },
  "status": "CANCELADA"
}
```
`cliente` e `entrega` são obrigatórios e seguem as mesmas regras do POST. `status` é opcional (`CONFIRMADA` ou `CANCELADA`). Itens não podem ser alterados.

### 4.4 Erro (qualquer resposta ≥ 400)
```json
{ "erro": { "codigo": "FORMATO_INVALIDO", "mensagem": "Corpo da requisicao fora do contrato",
            "detalhes": [ { "campo": "itens.0.quantidade", "problema": "Invalid input: expected number, received string" } ] } }
```
- `codigo`: identificador fixo do erro (tabela 5.2). O consumidor deve tratar pelo `codigo`, não pela `mensagem`.
- `mensagem`: texto explicativo.
- `detalhes` (opcional): lista de `{campo, problema}` em erros 400 de formato; lista de textos em erros 422.

## 5. Códigos de resposta HTTP

### 5.1 Status utilizados
| Código | Significado | Uso nesta API |
|---|---|---|
| 200 | OK | Consulta, atualização ou reenvio idempotente |
| 201 | Created | Venda registrada |
| 204 | No Content | Venda excluída |
| 400 | Bad Request | JSON malformado, formato fora do contrato, `Content-Type` diferente de JSON, id ou filtro inválido |
| 401 | Unauthorized | `X-API-Key` ausente ou inválida |
| 403 | Forbidden | Chave sem permissão para a operação |
| 404 | Not Found | Venda ou rota inexistente |
| 409 | Conflict | Alteração de venda cancelada; exclusão de venda confirmada |
| 422 | Unprocessable Content | Dados bem formados, mas inválidos (CPF, CEP, UF, quantidade, preço) |
| 500 | Internal Server Error | Erro inesperado no servidor do G2 |

### 5.2 Códigos de erro (`erro.codigo`)
| HTTP | Código | Quando ocorre |
|---|---|---|
| 400 | `JSON_INVALIDO` | Corpo não é um JSON válido |
| 400 | `CONTENT_TYPE_INVALIDO` | POST/PUT sem `Content-Type: application/json` |
| 400 | `FORMATO_INVALIDO` | Campo ausente, tipo errado ou campo não previsto |
| 400 | `ID_INVALIDO` | `{id}` não é inteiro positivo |
| 400 | `PARAMETRO_INVALIDO` | `status`, `data_inicio` ou `data_fim` inválidos |
| 401 | `NAO_AUTENTICADO` | Header `X-API-Key` ausente |
| 401 | `CHAVE_INVALIDA` | Chave desconhecida |
| 403 | `SEM_PERMISSAO` | Chave de leitura em operação de escrita |
| 404 | `VENDA_NAO_ENCONTRADA` | Venda inexistente |
| 404 | `ROTA_NAO_ENCONTRADA` | Endpoint inexistente |
| 409 | `VENDA_CANCELADA` | Tentativa de alterar venda cancelada |
| 409 | `VENDA_CONFIRMADA` | Tentativa de excluir venda confirmada |
| 422 | `DADOS_INVALIDOS` | Regra de negócio violada (lista em `detalhes`) |
| 500 | `ERRO_INTERNO` | Erro inesperado |

## 6. Orientações ao consumidor (Grupo 4)
- Tratar respostas pelo status HTTP e por `erro.codigo`.
- **Baixa:** cada venda `CONFIRMADA` deve ser baixada **uma única vez**. Guardar o `id` das vendas já baixadas e ignorá-las nas próximas consultas.
- **Estorno:** uma venda já baixada que aparecer como `CANCELADA` deve ser estornada uma única vez. Uma venda cancelada que o G4 nunca baixou não precisa de estorno.
- **Venda excluída:** só vendas canceladas podem ser excluídas. Se uma venda que o G4 já baixou não aparecer mais em nenhuma das duas listas (`?status=CONFIRMADA` e `?status=CANCELADA`), ela foi cancelada e excluída antes de o G4 ver o cancelamento: tratar como cancelada e estornar. `GET /vendas/{id}` confirma com **404** `VENDA_NAO_ENCONTRADA`.
- **Produtos:** `produto_id` é o código do produto no Estoque do G4. O G2 não consulta o Estoque ao registrar uma venda; produto inexistente no G4 ou quantidade maior que o saldo devem ser tratados pelo G4 (por exemplo, registrando a ocorrência), sem interromper o processamento das demais vendas.
- Em **500** ou falha de rede, tentar novamente mais tarde; em **401/403**, conferir a chave; em **404** de rota (`ROTA_NAO_ENCONTRADA`), conferir a URL-base (deve terminar em `/api/v1`).
- Campos novos podem ser acrescentados à resposta dentro da versão 1.0. O consumidor deve ignorar campos que não conhece. Remoção ou renomeação de campos só ocorre em uma nova versão (`/api/v2`), com aviso prévio.

## 7. Rastreabilidade
Toda requisição recebida é registrada pelo G2 na tabela `integracao_logs` (método, URL, status e tempo), com um identificador de correlação devolvido no header `X-Request-Id`. Se o G4 enviar o seu próprio `X-Request-Id`, o G2 usa o mesmo valor. O G4 pode se identificar pelo header `X-Sistema-Origem`; sem ele, as chamadas com a chave do G4 aparecem no log como `estoque-g4`.

## 8. Alterações no contrato
Mudança de rota, nome ou tipo de campo só entra depois de avisar o G4. Mudança incompatível vira nova versão (`/api/v2`), e a `v1` continua no ar até o G4 migrar.

## 9. Pontos para alinhar com o G4
- [ ] **Códigos de produto:** os `produto_id` das vendas devem ser os do cadastro do G4. O G4 passa ao G2 a lista de produtos (código, nome e preço) para o G2 usar ao registrar as vendas.
- [ ] **Banco do G2:** depois de começar a integração, o G2 não zera o banco, para que os `id` de venda não se repitam. Se for preciso zerar, os dois grupos combinam antes.
- [ ] Passar o endereço do túnel do G2 e confirmar a chave `estoque-key` no dia da apresentação.
