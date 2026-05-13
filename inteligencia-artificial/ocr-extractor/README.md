# Extrator de Texto

[![React](https://img.shields.io/badge/React-v18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-v4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Tesseract.js](https://img.shields.io/badge/Tesseract.js-OCR-563D7C)](https://tesseract.projectnaptha.com/)
[![Lucide](https://img.shields.io/badge/Lucide_Icons-F72C5B?logo=lucide&logoColor=white)](https://lucide.dev)

O **Extrator de Texto** é uma ferramenta de reconhecimento ótico de caracteres (OCR) direto no navegador. O sistema combina inteligência na nuvem com processamento local para garantir resultados perfeitos em qualquer condição de imagem.

---

## ✨ Funcionalidades Principais

- **🧠 Arquitetura Híbrida:** Utiliza primariamente uma API Cloud para processar imagens complexas e, opcionalmente, um motor local para garantir privacidade e funcionamento offline.
- **🛡️ Sistema de Fallback:** Caso a conexão falhe, o sistema alterna automaticamente para o processamento via Tesseract.js (LSTM), garantindo disponibilidade contínua.
- **⚙️ Dicionário de Auto-Correção:** Camada de pós-processamento que corrige erros comuns de OCR em português.
- **🎨 UI Glassmorphism:** Interface dark premium, totalmente responsiva e com layout estático, evitando quebras visuais ao carregar documentos de diferentes tamanhos.
- **🚀 Cópia Inteligente:** Texto extraído de forma limpa, pronto para ser utilizado em planilhas ou relatórios.

---

## 🛠️ Tech Stack

| Categoria | Tecnologia |
| :--- | :--- |
| **Frontend** | React 18 + Vite |
| **Linguagem** | TypeScript |
| **Estilização** | Tailwind CSS + Framer Motion |
| **OCR Cloud** | OCR.space API |
| **OCR Local** | Tesseract.js |
| **Ícones**| Lucide React |

---

## 📂 Estrutura de Pastas

```text
├── src/
│   ├── components/        # Componentes visuais (Header, etc.)
│   ├── services/          # Lógica de OCR e integração com APIs
│   ├── styles/            # CSS Global e temas
│   ├── App.tsx            # Componente principal
│   └── main.tsx           # Ponto de entrada
├── README.md              # Guia técnico de uso
```

---

## 🏁 Como Rodar

### Desenvolvimento Local
1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Inicie o servidor**
   ```bash
   npm run dev
   ```

### Via Docker
1. **Construa a imagem**
   ```bash
   docker build -t ocr-extractor .
   ```

2. **Rode o container**
   ```bash
   docker run -p 8080:80 ocr-extractor
   ```

---