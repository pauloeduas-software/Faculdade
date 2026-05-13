# Estágio de Build
FROM node:20-alpine as build

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala as dependências usando npm
RUN npm install

# Copia o restante do código
COPY . .

# Faz o build do projeto Vite
RUN npm run build

# Estágio de Produção
FROM nginx:alpine

# Copia os arquivos estáticos do build para o diretório do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta 80
EXPOSE 80

# Inicia o Nginx
CMD ["nginx", "-g", "daemon off;"]