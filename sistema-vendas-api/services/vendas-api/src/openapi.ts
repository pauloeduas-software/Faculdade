// As rotas de vendas espelham docs/contrato-vendas-estoque-g4.md: mudar algo nelas e mudar o contrato com o G4.
// /vendas/{id}/entrega e interna (perfil admin): e o G2 consumindo a API de Entregas do G7.

const CODIGOS_ERRO = [
  'JSON_INVALIDO', 'CONTENT_TYPE_INVALIDO', 'FORMATO_INVALIDO', 'ID_INVALIDO', 'PARAMETRO_INVALIDO',
  'NAO_AUTENTICADO', 'CHAVE_INVALIDA', 'SEM_PERMISSAO', 'VENDA_NAO_ENCONTRADA', 'ROTA_NAO_ENCONTRADA',
  'VENDA_CANCELADA', 'VENDA_CONFIRMADA', 'DADOS_INVALIDOS', 'ERRO_INTERNO',
]

// So da rota /vendas/{id}/entrega: falhas da API do G7, que o G4 nunca recebe.
const CODIGOS_ENTREGAS = [
  'ENTREGAS_CONTRATO_INVALIDO', 'ENTREGAS_RESPOSTA_INVALIDA', 'ENTREGAS_AUTENTICACAO', 'ENTREGAS_RESPOSTA_INESPERADA',
  'ENTREGAS_INDISPONIVEL', 'ENTREGAS_ERRO_INTERNO',
]

const erro = {
  type: 'object',
  required: ['erro'],
  properties: {
    erro: {
      type: 'object',
      required: ['codigo', 'mensagem'],
      properties: {
        codigo: { type: 'string', enum: CODIGOS_ERRO, description: 'Identificador fixo do erro: trate pelo codigo, nao pela mensagem' },
        mensagem: { type: 'string' },
        detalhes: {
          type: 'array',
          description: 'Lista de {campo, problema} em erros 400 de formato; lista de textos em erros 422',
          items: {},
        },
      },
    },
  },
  example: { erro: { codigo: 'VENDA_NAO_ENCONTRADA', mensagem: 'Venda 999 nao encontrada' } },
}

const resp = (descricao: string, schema = 'Erro') => ({
  description: descricao,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
})
const comuns = {
  401: resp('`NAO_AUTENTICADO` (sem X-API-Key) ou `CHAVE_INVALIDA`'),
  500: resp('`ERRO_INTERNO`'),
}
const escrita = { ...comuns, 403: resp('`SEM_PERMISSAO`: chave de leitura em operacao de escrita') }
const header = (descricao: string, schema: object = { type: 'string' }) => ({ description: descricao, schema })
const requestId = { 'X-Request-Id': header('Identificador de correlacao (o recebido na requisicao ou um novo UUID)') }

const id = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 }, description: 'Identificador da venda' }
const corpo = (ref: string) => ({ required: true, content: { 'application/json': { schema: { $ref: ref } } } })
const venda = { content: { 'application/json': { schema: { $ref: '#/components/schemas/Venda' } } } }
const tipoStatus = { type: 'string', enum: ['CONFIRMADA', 'CANCELADA'] }

const exemploVenda = {
  id: 3,
  cliente: { nome: 'Ana Clara Ribeiro', documento: '52998224725' },
  entrega: { endereco: 'Rua Augusta, 1520, ap. 34', cidade: 'São Paulo', uf: 'SP', cep: '01304001' },
  itens: [
    { produto_id: 101, nome_produto: 'Teclado Mecanico', quantidade: 1, preco_unitario: 250.9, subtotal: 250.9 },
    { produto_id: 103, nome_produto: 'Mouse Optico', quantidade: 2, preco_unitario: 89.9, subtotal: 179.8 },
  ],
  valor_total: 430.7,
  status: 'CONFIRMADA',
  motivo_cancelamento: null,
  criado_em: '2026-11-13T14:39:45.666Z',
  atualizado_em: '2026-11-13T14:39:45.666Z',
}

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API de Vendas (Grupo 2)',
    version: '1.0.0',
    description:
      'Registro e consulta de vendas. Consumida pelo Grupo 4 (Estoque).\n\n' +
      '**Grupo 4:** use `GET /vendas?status=CONFIRMADA` para obter as vendas a baixar do estoque, `GET /vendas?status=CANCELADA` ' +
      'para as vendas cujos itens devem voltar ao estoque e `GET /vendas/{id}` para consultar uma venda. ' +
      'Guarde o `id` das vendas ja processadas para baixar e estornar uma unica vez.\n\n' +
      '**Autenticacao:** header `X-API-Key`. A chave de perfil `leitura` so pode usar GET (demais metodos -> 403).\n\n' +
      '**Idempotencia:** envie `Idempotency-Key` no POST; o reenvio devolve a venda ja criada (200 + `Idempotent-Replayed: true`).\n\n' +
      '**Erros:** corpo `{"erro": {"codigo", "mensagem", "detalhes?"}}`; trate pelo `codigo`. Rota inexistente -> 404 `ROTA_NAO_ENCONTRADA`.\n\n' +
      '**Saude:** `GET /health` (sem autenticacao) -> `{"status":"ok","servico":"vendas-g2","versao":"1.0"}`.\n\n' +
      'Campos novos podem ser acrescentados a resposta dentro da versao 1.0; ignore campos que nao conhece.\n\n' +
      '**Entregas (G7):** `GET /vendas/{id}/entrega` (perfil admin, uso interno do G2) consulta a entrega da venda na API do Grupo 7.',
  },
  // Relativo: funciona em http://localhost:3001/docs e em http://<IP-do-G2>:3001/docs.
  servers: [{ url: '/api/v1' }],
  security: [{ ApiKey: [] }],
  tags: [{ name: 'Vendas' }, { name: 'Entregas (G7)' }, { name: 'Integracao' }],
  paths: {
    '/vendas': {
      get: {
        tags: ['Vendas'],
        summary: 'Listar vendas (filtros combinaveis)',
        parameters: [
          { name: 'status', in: 'query', schema: tipoStatus },
          { name: 'data_inicio', in: 'query', schema: { type: 'string' }, example: '2026-11-01', description: 'Vendas criadas a partir desta data (AAAA-MM-DD) ou data-hora ISO 8601' },
          { name: 'data_fim', in: 'query', schema: { type: 'string' }, example: '2026-11-30', description: 'Vendas criadas ate esta data; com AAAA-MM-DD inclui o dia inteiro (UTC)' },
        ],
        responses: {
          200: {
            description: 'Lista ordenada por id crescente (`[]` se nao houver vendas)', headers: requestId,
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Venda' } } } },
          },
          400: resp('`PARAMETRO_INVALIDO`'), ...comuns,
        },
      },
      post: {
        tags: ['Vendas'],
        summary: 'Registrar venda',
        description:
          'Valida o formato (400) e as regras (422) e grava a venda e os itens como CONFIRMADA. ' +
          'O G2 calcula o subtotal de cada item e o valor total.',
        parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' }, description: 'Opcional, recomendado. Uma chave por venda.' }],
        requestBody: corpo('#/components/schemas/NovaVenda'),
        responses: {
          201: { description: 'Venda registrada', headers: { Location: header('/api/v1/vendas/{id}'), ...requestId }, ...venda },
          200: {
            description: 'Reenvio com a mesma Idempotency-Key: devolve a venda ja criada, sem criar outra',
            headers: { 'Idempotent-Replayed': header('Sempre `true`'), Location: header('/api/v1/vendas/{id}') }, ...venda,
          },
          400: resp('`JSON_INVALIDO`, `CONTENT_TYPE_INVALIDO` ou `FORMATO_INVALIDO` (campo ausente, tipo errado ou nao previsto)'),
          ...escrita,
          422: resp('`DADOS_INVALIDOS` (lista em `detalhes`)'),
        },
      },
    },
    '/vendas/{id}': {
      get: {
        tags: ['Vendas'],
        summary: 'Consultar venda', parameters: [id],
        responses: {
          200: { description: 'Venda', headers: requestId, ...venda },
          400: resp('`ID_INVALIDO`'), 404: resp('`VENDA_NAO_ENCONTRADA`'), ...comuns,
        },
      },
      put: {
        tags: ['Vendas'],
        summary: 'Atualizar cliente/entrega ou cancelar a venda',
        description:
          '| Status atual | Status pedido | Resultado |\n|---|---|---|\n' +
          '| CONFIRMADA | CONFIRMADA ou omitido | atualiza cliente/entrega |\n' +
          '| CONFIRMADA | CANCELADA | cancela (o G4 passa a ve-la em `?status=CANCELADA`) |\n' +
          '| CANCELADA | qualquer | 409 `VENDA_CANCELADA` |\n\n' +
          'Ao cancelar, `motivo_cancelamento` recebe `"cancelada via API"`.',
        parameters: [id], requestBody: corpo('#/components/schemas/AtualizarVenda'),
        responses: {
          200: { description: 'Venda atualizada', headers: requestId, ...venda },
          400: resp('`JSON_INVALIDO`, `CONTENT_TYPE_INVALIDO`, `FORMATO_INVALIDO` ou `ID_INVALIDO`'),
          ...escrita,
          404: resp('`VENDA_NAO_ENCONTRADA`'),
          409: resp('`VENDA_CANCELADA`'),
          422: resp('`DADOS_INVALIDOS`'),
        },
      },
      delete: {
        tags: ['Vendas'],
        summary: 'Excluir venda cancelada', parameters: [id],
        responses: {
          204: { description: 'Excluida (sem corpo)' },
          400: resp('`ID_INVALIDO`'), ...escrita,
          404: resp('`VENDA_NAO_ENCONTRADA`'), 409: resp('`VENDA_CONFIRMADA`: cancele antes com PUT'),
        },
      },
    },
    '/vendas/{id}/entrega': {
      get: {
        tags: ['Entregas (G7)'],
        summary: 'Consultar a entrega da venda na API do G7 - perfil admin',
        description:
          'O G2 chama `GET /entregas?id_pedido={id}` no G7 e, se houver entrega, `GET /entregas/{id_entrega}/historico`. ' +
          'Com mais de uma entrega, vale a que nao esta CANCELADA. As respostas sao validadas contra o contrato do G7 ' +
          '(campos obrigatorios, tipos, `status_entrega`, `id_pedido` igual a venda, nulos so com `pendencias`); ' +
          'fora do contrato, nada e gravado. Valida, a entrega fica guardada na venda (`id_entrega`, `codigo_rastreio`, ' +
          '`status_entrega`), e `alterada` diz se a `data_atualizacao` mudou desde a leitura anterior.\n\n' +
          'Cada chamada ao G7 usa timeout de 5 s e ate 3 novas tentativas (1 s, 2 s, 4 s) em falha de rede, timeout ou 5xx, ' +
          'respeitando o `Retry-After` do 503.',
        parameters: [id],
        responses: {
          200: {
            description: 'Entrega lida do G7 (`entrega: null` se o pedido ainda nao gerou entrega)', headers: requestId,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ConsultaEntrega' } } },
          },
          400: resp('`ID_INVALIDO`'), ...escrita,
          404: resp('`VENDA_NAO_ENCONTRADA` (o G7 nao e chamado)'),
          502: resp('`ENTREGAS_CONTRATO_INVALIDO` (campos com problema em `detalhes`), `ENTREGAS_RESPOSTA_INVALIDA`, `ENTREGAS_AUTENTICACAO` ou `ENTREGAS_RESPOSTA_INESPERADA`', 'ErroEntregas'),
          503: resp('`ENTREGAS_INDISPONIVEL` ou `ENTREGAS_ERRO_INTERNO`, depois das novas tentativas', 'ErroEntregas'),
        },
      },
    },
    '/integracao/logs': {
      get: {
        tags: ['Integracao'],
        summary: 'Registro das chamadas recebidas (ENTRADA) e feitas a outros grupos (SAIDA) - perfil admin',
        parameters: [
          { name: 'direcao', in: 'query', schema: { type: 'string', enum: ['ENTRADA', 'SAIDA'] } },
          { name: 'limite', in: 'query', schema: { type: 'integer', default: 50, maximum: 500 } },
        ],
        responses: {
          200: { description: 'Mais recentes primeiro', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Log' } } } } },
          ...escrita,
        },
      },
    },
  },
  components: {
    securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
    schemas: {
      Erro: erro,
      ErroEntregas: {
        type: 'object', required: ['erro'],
        properties: {
          erro: {
            type: 'object', required: ['codigo', 'mensagem'],
            properties: {
              codigo: { type: 'string', enum: CODIGOS_ENTREGAS },
              mensagem: { type: 'string' },
              detalhes: { type: 'array', description: 'Lista de {campo, problema} em ENTREGAS_CONTRATO_INVALIDO', items: {} },
            },
          },
        },
        example: {
          erro: {
            codigo: 'ENTREGAS_CONTRATO_INVALIDO', mensagem: 'Resposta do G7 para a venda 101 nao segue o contrato',
            detalhes: [{ campo: 'dados.0.transportadora', problema: 'nulo sem pendencias' }],
          },
        },
      },
      Cliente: {
        type: 'object', required: ['nome', 'documento'], additionalProperties: false,
        properties: {
          nome: { type: 'string', description: 'Ao menos 2 caracteres', example: 'Ana Clara Ribeiro' },
          documento: { type: 'string', description: 'CPF (11) ou CNPJ (14 digitos); pontuacao e aceita e removida', example: '52998224725' },
        },
      },
      Entrega: {
        type: 'object', required: ['endereco', 'cidade', 'uf', 'cep'], additionalProperties: false,
        properties: {
          endereco: { type: 'string', example: 'Rua Augusta, 1520, ap. 34' },
          cidade: { type: 'string', example: 'São Paulo' },
          uf: { type: 'string', description: 'UF brasileira (maiuscula ou minuscula)', example: 'SP' },
          cep: { type: 'string', description: '8 digitos; traco e aceito e removido', example: '01304001' },
        },
      },
      NovaVenda: {
        type: 'object', required: ['cliente', 'entrega', 'itens'], additionalProperties: false,
        description: 'Subtotal, total e status nao sao enviados: sao calculados pelo G2.',
        properties: {
          cliente: { $ref: '#/components/schemas/Cliente' }, entrega: { $ref: '#/components/schemas/Entrega' },
          itens: {
            type: 'array', minItems: 1, description: 'Sem repetir produto na mesma venda',
            items: {
              type: 'object', required: ['produto_id', 'nome_produto', 'quantidade', 'preco_unitario'], additionalProperties: false,
              properties: {
                produto_id: { type: 'integer', minimum: 1, example: 101, description: 'Codigo do produto no Estoque (G4)' },
                nome_produto: { type: 'string', example: 'Teclado Mecanico', description: 'Nao vazio' },
                quantidade: { type: 'integer', minimum: 1, example: 1 },
                preco_unitario: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 250.9, description: 'Maior que zero, ate 2 casas decimais' },
              },
            },
          },
        },
      },
      AtualizarVenda: {
        type: 'object', required: ['cliente', 'entrega'], additionalProperties: false,
        description: 'Itens nao podem ser alterados.',
        properties: {
          cliente: { $ref: '#/components/schemas/Cliente' }, entrega: { $ref: '#/components/schemas/Entrega' },
          status: { ...tipoStatus, description: 'Opcional' },
        },
      },
      Venda: {
        type: 'object',
        required: ['id', 'cliente', 'entrega', 'itens', 'valor_total', 'status', 'motivo_cancelamento', 'criado_em', 'atualizado_em'],
        properties: {
          id: { type: 'integer', description: 'Identificador gerado pelo G2; nunca e reutilizado' },
          cliente: { $ref: '#/components/schemas/Cliente' }, entrega: { $ref: '#/components/schemas/Entrega' },
          itens: {
            type: 'array',
            items: {
              type: 'object', required: ['produto_id', 'nome_produto', 'quantidade', 'preco_unitario', 'subtotal'],
              properties: {
                produto_id: { type: 'integer', description: 'Codigo do produto no Estoque (G4)' },
                nome_produto: { type: 'string' },
                quantidade: { type: 'integer', description: 'Quantidade vendida (a baixar no estoque)' },
                preco_unitario: { type: 'number', description: 'Preco unitario praticado na venda' },
                subtotal: { type: 'number', description: 'quantidade x preco_unitario, 2 casas' },
              },
            },
          },
          valor_total: { type: 'number', description: 'Soma dos subtotais, 2 casas' },
          status: tipoStatus,
          motivo_cancelamento: { type: 'string', nullable: true, description: 'Preenchido apenas quando status = CANCELADA' },
          criado_em: { type: 'string', format: 'date-time', description: 'UTC' },
          atualizado_em: { type: 'string', format: 'date-time', description: 'UTC; muda a cada alteracao, inclusive no cancelamento' },
        },
        example: exemploVenda,
      },
      ConsultaEntrega: {
        type: 'object', required: ['venda_id', 'entrega', 'historico', 'leitura_anterior', 'alterada'],
        properties: {
          venda_id: { type: 'integer' },
          entrega: {
            type: 'object', nullable: true,
            description: 'Entrega como o G7 devolve (contrato do G7), sem os campos que o G2 nao conhece',
            properties: {
              id_entrega: { type: 'integer' }, codigo_rastreio: { type: 'string', example: 'ENT-2026-000001' },
              id_pedido: { type: 'integer', description: 'Igual ao id da venda' },
              id_cliente: { type: 'integer', nullable: true }, nome_destinatario: { type: 'string' },
              transportadora: { type: 'string', nullable: true },
              endereco_destino: { type: 'object' },
              data_prevista: { type: 'string', format: 'date', nullable: true },
              valor_frete: { type: 'number', nullable: true },
              status_entrega: { type: 'string', enum: ['AGUARDANDO_COLETA', 'EM_TRANSITO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'NAO_ENTREGUE', 'DEVOLVIDA', 'CANCELADA'] },
              data_entrega: { type: 'string', format: 'date', nullable: true },
              origem: { type: 'string' },
              pendencias: { type: 'array', items: { type: 'string' }, description: 'Campos ainda nulos no G7' },
              data_criacao: { type: 'string', format: 'date-time' }, data_atualizacao: { type: 'string', format: 'date-time' },
            },
          },
          historico: {
            type: 'array', description: 'Mudancas de status, da mais antiga para a mais recente',
            items: { type: 'object', properties: { status_entrega: { type: 'string' }, data_hora: { type: 'string', format: 'date-time' }, observacao: { type: 'string', nullable: true } } },
          },
          leitura_anterior: {
            type: 'object', nullable: true, description: 'O que estava guardado na venda antes desta consulta',
            properties: { id_entrega: { type: 'integer' }, codigo_rastreio: { type: 'string' }, status_entrega: { type: 'string' }, data_atualizacao: { type: 'string', format: 'date-time' } },
          },
          alterada: { type: 'boolean', description: 'A entrega mudou desde a leitura anterior (outra entrega ou outra data_atualizacao)' },
        },
      },
      Log: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, direcao: { type: 'string', enum: ['ENTRADA', 'SAIDA'] },
          sistema: { type: 'string', description: 'Origem (ENTRADA) ou destino (SAIDA)' },
          metodo: { type: 'string' }, url: { type: 'string' },
          status: { type: 'integer', nullable: true, description: 'null = sem resposta (timeout ou rede)' },
          duracao_ms: { type: 'integer' }, tentativa: { type: 'integer' },
          erro: { type: 'string', nullable: true }, correlacao: { type: 'string', nullable: true },
          criado_em: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
}
