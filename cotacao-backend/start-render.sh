#!/usr/bin/env bash
# Forced LF line endings

# 1. Instala o Tailscale se ainda não estiver instalado
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Inicia o Tailscale em modo "userspace" (necessário para o Render)
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
sleep 5

# 3. Autentica usando a chave que colocamos no painel do Render
tailscale up --authkey=${TAILSCALE_AUTHKEY}

# 4. Inicia a sua API (ajuste se o seu comando for diferente)
npm run start
