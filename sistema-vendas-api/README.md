# Sistema de Vendas — Integração via API REST

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Swagger](https://img.shields.io/badge/Swagger-85EA2D?logo=swagger&logoColor=black)](https://swagger.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

Sistema de Vendas do Grupo 2, feito para o trabalho de Integração de Aplicações por **API REST**. Ele faz parte de uma cadeia de sistemas desenvolvidos por grupos diferentes da turma, que se comunicam apenas por HTTP, sem nenhum acesso ao banco dos outros grupos:

```
API de Entregas (G7) ──HTTP/JSON──▶ Vendas (G2) ──HTTP/JSON──▶ Estoque (G4)
     fornecedor          consome         │        fornece        consumidor
                                         │
                                   SQLite (vendas.db)
```

- **Consome** a API de Entregas do Grupo 7 para acompanhar a entrega e o rastreio de cada venda.
- **Fornece** a API de Vendas, que o Estoque (Grupo 4) usa para dar baixa nos produtos vendidos e estornar as vendas canceladas.

> O mesmo sistema também foi feito com integração **por banco de dados** (views no PostgreSQL), em [`sistema-vendas-banco`](../sistema-vendas-banco).

---

## ✨ Funcionalidades Principais

- **API de Vendas versionada** (`/api/v1`) com criação, consulta, edição, cancelamento e exclusão de vendas, documentada em **Swagger/OpenAPI** (`/docs`).
- **Autenticação e autorização** por `X-API-Key`, com os perfis `admin` e `leitura` (a chave do Estoque só faz GET).
- **Idempotência** no `POST` pelo header `Idempotency-Key`: o reenvio devolve a venda já criada, em vez de duplicá-la.
- **Consumidor resiliente da API do G7**: timeout de 5 s, até 3 novas tentativas com espera crescente (1 s, 2 s, 4 s) em falha de rede, timeout ou 5xx, respeitando o `Retry-After`.
- **Validação do contrato do G7**: as respostas fora do contrato (campo ausente, tipo errado, status fora do enum, entrega de outra venda) são recusadas, a venda não é alterada e os campos novos são ignorados.
- **Erros padronizados**: formato inválido (400), regra de negócio (422), falhas do sistema externo (502/503), sempre com `erro.codigo` e os campos com problema em `detalhes`.
- **Rastreabilidade**: cada requisição recebida e cada chamada ao G7 é registrada em `integracao_logs`, com um `X-Request-Id` (UUID) que correlaciona os logs dos dois lados.
- **Tela em React** com a lista de vendas, a consulta da entrega no G7, uma nova venda e um painel de integração com os logs.

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
| :--- | :--- |
| **Linguagem** | TypeScript (executado direto pelo Node, sem etapa de build) |
| **API** | Node.js 24, Express 5, Zod |
| **Banco de Dados** | SQLite (`node:sqlite`) |
| **Documentação** | OpenAPI 3 + Swagger UI |
| **Front-end** | React 19 + Vite |
| **Testes** | `node:test`, por HTTP, com banco em memória |
| **Deploy** | Docker (API em Node, tela servida por nginx) |

---

## 📂 Estrutura Arquitetural

```text
├── services/vendas-api/
│   ├── src/
│   │   ├── app.ts, routes.ts    # Express, rotas e validação (Zod)
│   │   ├── vendasService.ts     # Regras de negócio das vendas
│   │   ├── entregasClient.ts    # Consumidor da API de Entregas (G7)
│   │   ├── entregasService.ts   # Validação do contrato do G7 e gravação do rastreio
│   │   ├── clienteHttp.ts       # Cliente HTTP com timeout, retry e log
│   │   ├── auth.ts              # Autenticação por X-API-Key e perfis
│   │   ├── logger.ts            # Logs de integração com id de correlação
│   │   └── openapi.ts           # Especificação servida no Swagger
│   ├── db/schema.sql            # Tabelas do SQLite
│   └── test/                    # Testes da API, do cliente HTTP e do consumo do G7
├── src/                         # Tela em React
├── docs/                        # Contrato, documentação da API e relatório técnico
├── Dockerfile.api, Dockerfile.front, nginx.conf, docker-compose.yml
└── package.json
```

---

## 🚀 Como Rodar

Pré-requisito: **Node.js 24** ou mais recente (usa o `node:sqlite` e executa TypeScript direto).

```bash
npm install
cp .env.example .env
npm run dev        # tela em http://localhost:3000 e API em http://localhost:3001
```

- Swagger: http://localhost:3001/docs
- Chaves padrão: `vendas-admin-key` (admin) e `estoque-key` (somente leitura)
- A consulta de entregas precisa da chave do G2 na API do G7 em `ENTREGAS_API_KEY`. Essa chave não está no repositório; sem ela, as rotas de vendas funcionam normalmente e só a consulta de entregas responde com erro.

Exemplo:

```bash
curl -H 'X-API-Key: estoque-key' 'localhost:3001/api/v1/vendas?status=CONFIRMADA'
```

Com Docker: `docker compose up --build` (o nginx do front repassa `/api`, `/docs` e `/openapi.json` para a API, e o banco fica no volume `vendas-data`).

---

## 🧪 Testes

```bash
npm test
```

São 32 testes em 3 suítes, todos feitos por HTTP com banco em memória:

- **API de Vendas**: cada rota do contrato com o G4, testada do jeito que o G4 a usa (autenticação, perfis, validação, idempotência e ciclo de vida da venda).
- **Cliente HTTP**: timeout, novas tentativas, `Retry-After` e registro no log.
- **Consumo do G7**: um G7 simulado devolve respostas válidas, fora do contrato e com falhas (401, 500, 503, fora do ar), e os testes conferem como o G2 reage a cada uma.

A saída completa está em [`docs/evidencias-testes.txt`](docs/evidencias-testes.txt).

---

## 📄 Documentação

| Arquivo | Conteúdo |
| :--- | :--- |
| [`documentacao-api.md`](docs/documentacao-api.md) | Rotas, perfis, exemplos com curl e ciclo de vida da venda |
| [`contrato-vendas-estoque-g4.md`](docs/contrato-vendas-estoque-g4.md) | Contrato da API que o G2 fornece ao Estoque |
| [`relatorio-tecnico.md`](docs/relatorio-tecnico.md) | Arquitetura, decisões técnicas e dificuldades encontradas |
| [`situacoes-problema.md`](docs/situacoes-problema.md) | Como cada falha do sistema externo é detectada e tratada |

O contrato com o G7 ficou fora do repositório porque contém a chave de acesso do grupo à API deles.
