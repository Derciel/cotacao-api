# Estágio de Build
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio de Produção com suporte a Puppeteer
FROM ghcr.io/puppeteer/puppeteer:latest
USER root
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/src/documents/templates ./src/documents/templates

# Variáveis de ambiente para o Puppeteer no Render
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 10000
CMD ["node", "dist/main"]