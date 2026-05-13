# ShopFlow-API - API de E-commerce

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeORM](https://img.shields.io/badge/TypeORM-FE0808?logo=typeorm&logoColor=white)](https://typeorm.io/)
[![JWT](https://img.shields.io/badge/JWT-000000?logo=json-web-tokens&logoColor=white)](https://jwt.io/)

ShopFlow-API é um motor de back-end escalável construído com Node.js e TypeScript, focado na gestão de produtos, categorias e controle de estoque para lojas virtuais.

---

## ✨ Funcionalidades Principais

- **Gestão de Catálogo**: Controle de produtos e categorias com lógica de situações (Ativo, Esgotado, Em Análise).
- **Autenticação Segura**: Sistema de login com JWT e proteção de rotas com criptografia de senhas (bcryptjs).
- **Infraestrutura**: Gerenciamento de banco de dados PostgreSQL através do TypeORM, com suporte a Migrations e Seeds.
- **Validação de Dados**: Validação de payloads com a biblioteca Yup.
- **Serviços de Notificação**: Integração com Nodemailer para envio de e-mails do sistema.

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
| :--- | :--- |
| **Linguagem** | TypeScript |
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Banco de Dados** | PostgreSQL |
| **ORM** | TypeORM |
| **Segurança** | BcryptJS, JWT, Yup |

---

## 📂 Estrutura Arquitetural

```text
├── src/
│   ├── controllers/       # Lógica de controle das rotas
│   ├── entity/            # Modelos do banco de dados (TypeORM)
│   ├── middlewares/       # Filtros e validações (JWT, Yup)
│   ├── migration/         # Histórico do banco de dados
│   ├── services/          # Regras de negócio e integrações
│   └── index.ts           # Ponto de entrada da API
├── package.json           # Dependências e scripts
└── README.md              # Documentação da API
```

---

## 🚀 Como Rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente no arquivo `.env`.
3. Execute as migrations:
   ```bash
   npm run typeorm migration:run
   ```
4. Inicie o servidor:
   ```bash
   npm run start:watch
   ```

---
