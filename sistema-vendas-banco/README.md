# Sistema de Vendas — Grupo 2

Trabalho prático de Integração de Aplicações por Banco de Dados. O Sistema de Vendas:

- **consome** as entregas do Grupo 7 (Sistema de Entregas): lê uma view do banco deles, valida, transforma e grava no nosso banco (`server/integracao/`);
- **fornece** ao Grupo 4 (Sistema de Estoque) os itens vendidos, numa view do nosso banco (`integracao.vw_integracao_vendas`).

Stack: React + Vite (`src/`), Express + `pg` com SQL parametrizado, sem ORM (`server/`), PostgreSQL 16 no Docker (`database/`).

Pré-requisitos: Docker com Compose, Node 20.19+ (ou 22.12+, exigência do Vite) e npm ou bun.

## Portas

| Serviço | Porta | Variável no `.env` |
|---|---|---|
| Front (Vite) | 3000 | `FRONT_PORT` |
| Back (Express) | 3001 | `PORT` |
| Postgres | 3002 (5432 dentro do container) | `POSTGRES_PORT` |

As portas são da máquina, não do projeto: se outro projeto estiver usando alguma delas (ex.: outro Postgres na 3002), pare-o antes de subir este. O Vite usa `strictPort`, então falha em vez de trocar de porta.

## Como rodar

```bash
cp .env.example .env     # e troque as senhas
npm install
npm run db:reset         # recria o banco do zero com os scripts de database/ (APAGA os dados)
npm run dev              # front em http://localhost:3000 e back em http://localhost:3001
```

Com o bun, os mesmos comandos: `bun install`, `bun run db:reset`, `bun run dev` (o `bun.lock` e o `package-lock.json` estão sincronizados).

| Script | O que faz |
|---|---|
| `npm run dev` | Front e back juntos (`dev:web` e `dev:server` separados) |
| `npm run db:reset` | `docker compose down -v` + `up -d`: recria o banco e roda os scripts de `database/` |
| `npm run db:psql` | psql como superusuário `grupo2`, pelo socket do container |
| `npm run integrar` | Roda a integração com o Grupo 7 pelo terminal e imprime o relatório |
| `npm run build` / `npm run build:server` | Compila o front / o back |
| `npm run start:server` | Executa o back compilado |
| `npm run lint` | Oxlint |

Teste rápido: `curl http://localhost:3001/api/health` (direto) ou `curl http://localhost:3000/api/health` (pelo proxy do Vite). Responde 200 com o banco no ar e 503 (`"banco": "indisponível"`) quando ele não responde.

## Telas

Menu lateral com **Clientes**, **Vendedores**, **Produtos**, **Vendas** e **Integração**.

- Cadastros: lista com busca, filtro ativo/inativo e paginação (na URL), formulário com as mesmas validações da API, botão Desativar/Ativar em cada linha e exclusão com confirmação (se o registro tiver vendas, o banco barra e a tela oferece Desativar).
- Vendas: igual aos cadastros. A lista (filtros por status, cliente e período) tem em cada linha o próximo passo do status (**Confirmar**, **Enviar p/ entrega** ou **Marcar entregue**), **Cancelar**, **Editar** e **Excluir**; o que o status não permite aparece desabilitado, com o motivo ao passar o mouse. Nova venda e Editar venda são o mesmo formulário (prévia do total; itens editáveis só com a venda ABERTA; **Salvar** grava dados e itens numa transação só) e a edição mostra o bloco **Entrega** (dados integrados do Grupo 7).
- Integração: duas abas. **Receber do Grupo 7**: situação do banco do Grupo 7 (verde, amarelo ou vermelho, com o motivo), botão **Executar integração**, o resultado em uma frase com os problemas encontrados, **Ver detalhes** e **Ver relatório**, e as execuções anteriores. **Enviar ao Grupo 4** (`?aba=enviar`): todas as linhas da view que o Grupo 4 lê, sem paginação. A view e os usuários com suas permissões estão definidos em `database/04_integracao.sql` e `database/05_usuarios_permissoes.sh`.

## Usuários do banco

| Usuário | Uso | Acesso |
|---|---|---|
| `grupo2` | Superusuário, dono das tabelas | Só pelo socket do container (`npm run db:psql`) |
| `grupo2_app` | API e consumidor (`DATABASE_URL`) | TCP, só no `grupo2_db`; lê e grava dados (sem apagar entregas), não altera a estrutura, não apaga nem edita erros do log; sem privilégios nas sequences e sem `EXECUTE` nas funções, exceto as duas que as triggers de itens chamam |
| `grupo4_integracao` | Grupo 4 – Estoque | TCP, só no `grupo2_db`; apenas `SELECT` na view de integração |

O nosso consumidor entra no banco do Grupo 7 com o usuário `grupo2_consumidor`, criado e configurado por eles (só `SELECT` na view de entregas, somente leitura, 30 s, 5 conexões).

## Integração com o Grupo 7 (consumidor)

O banco do Grupo 7 é o `grupo7_db`, no notebook deles, acessível só na rede da sala. Coloque no `.env` a connection string com o IP e a senha que o Grupo 7 informar:

```
GRUPO7_DATABASE_URL=postgresql://grupo2_consumidor:<SENHA>@<IP_DO_GRUPO7>:5437/grupo7_db?sslmode=disable
```

Os dados de teste combinados com os Grupos 5 e 7 são as vendas 101 a 107 de `database/03_dados_teste.sql`.

O processo fica em `server/integracao/`, um arquivo por etapa: `conexao.ts` → `estrutura.ts` → `consulta.ts` → `validacao.ts` → `transformacao.ts` → `processamento.ts` → `log.ts` → `relatorio.ts`, orquestrados por `executar.ts`. As regras combinadas com o Grupo 7 ficam em `config.ts`.

Três formas de executar:

```bash
# Tela: Integração → Receber do Grupo 7 → "Executar integração"
curl -X POST http://localhost:3001/api/integracoes/entregas/executar   # API: relatório em JSON
npm run integrar                                                       # terminal: relatório em texto
```

| Rota | O que faz |
|---|---|
| `POST /api/integracoes/entregas/executar` | Executa e devolve o relatório (201; 409 `INTEGRACAO_EM_ANDAMENTO` se já houver uma rodando) |
| `GET /api/integracoes/entregas/status` | Testa a conexão e a estrutura da view do Grupo 7, sem processar |
| `GET /api/integracoes?page&limit` | Histórico de execuções |
| `GET /api/integracoes/:id` | Uma execução com os erros |
| `GET /api/integracoes/:id/relatorio` | Relatório em texto puro |
| `GET /api/integracoes/config` | Conexões (sem senha) e permissões de cada usuário |
| `GET /api/integracoes/produtor/preview?limit` | As linhas da view que o Grupo 4 lê (sem `limit`, todas) |

Garantias: comparação em lote com as entregas já gravadas (as que não mudaram não abrem transação), uma transação por registro novo ou alterado (com `FOR UPDATE` na venda), log gravado fora dessas transações, totais da execução gravados a cada 100 registros e no fim, uma execução por vez (`pg_try_advisory_lock`), execução interrompida marcada como `FALHOU` na seguinte (com o que chegou a gravar), nada duplicado ao rodar de novo e até 3 tentativas de conexão. Processados = registros válidos = inseridos + atualizados + sem alteração. Para demonstrar uma queda no meio: `INTEGRACAO_SIMULAR_QUEDA_APOS=5 npm run integrar`.
