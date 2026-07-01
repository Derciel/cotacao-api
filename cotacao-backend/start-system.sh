#!/bin/bash
echo "======================================================="
echo "          Nicopel Cargo - Sistema de Cotacao           "
echo "======================================================="
echo ""

# 1. Verificar conexao com o Tailscale
echo "[1/3] Verificando conexao com o Tailscale..."
if ! command -v tailscale &> /dev/null; then
    echo "[AVISO] Comando 'tailscale' nao encontrado. Certifique-se de que o Tailscale esta conectado."
elif ! tailscale status &> /dev/null; then
    echo "[AVISO] Tailscale parece estar desligado ou desconectado."
else
    echo "[OK] Tailscale detectado e ativo!"
fi
echo ""

# 2. Entrar no diretorio da aplicacao
echo "[2/3] Entrando no diretorio da aplicacao..."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"
echo "Diretorio atual: $(pwd)"
echo ""

# 3. Iniciar o servidor NestJS
echo "[3/3] Iniciando o servidor NestJS..."
echo "O sistema estara disponivel em: http://localhost:3000"
echo ""
npm run start
