# ShopFlow-API - API de E-commerce em TypeScript

ShopFlow-API e um motor de back-end escalavel construido com Node.js e TypeScript, focado na gestao de produtos, categorias e controle de estoque para lojas virtuais.

---

## Funcionalidades Principais

- Gestao de Catalogo: Controle de produtos e categorias com logica de situacoes (Ativo, Esgotado, Em Analise).
- Autenticacao Segura: Sistema de login com JWT e protecao de rotas com criptografia de senhas (bcryptjs).
- Infraestrutura: Gerenciamento de banco de dados PostgreSQL atraves do TypeORM, com suporte a Migrations e Seeds.
- Validacao de Dados: Validacao de payloads com a biblioteca Yup.
- Servicos de Notificacao: Integracao com Nodemailer para envio de e-mails do sistema.

---

## Stack Tecnologica

- Linguagem: TypeScript
- Runtime: Node.js
- Web Framework: Express.js
- Banco de Dados: PostgreSQL
- ORM: TypeORM
- Seguranca: BcryptJS, JWT, Yup

---

## Como Rodar

1. Entre na pasta backend/shopflow-api.
2. Instale as dependencias: `npm install`.
3. Configure as variaveis de ambiente no arquivo .env.
4. Execute as migrations: `npm run typeorm migration:run`.
5. Inicie o servidor: `npm run start:watch`.

---
Projeto academico focado em engenharia de back-end e escalabilidade.
