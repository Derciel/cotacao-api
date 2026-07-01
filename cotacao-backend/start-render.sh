#!/usr/bin/env bash
# Forced LF line endings

# 1. Baixar e descompactar binários estáticos do Tailscale (sem precisar de ROOT/SUDO)
if [ ! -f ./tailscale ] || [ ! -f ./tailscaled ]; then
  echo "Baixando binários estáticos do Tailscale..."
  VERSION="1.68.2"
  TGZ="tailscale_${VERSION}_amd64.tgz"
  curl -sLO "https://pkgs.tailscale.com/stable/${TGZ}"
  tar xzf "${TGZ}"
  cp "tailscale_${VERSION}_amd64/tailscale" ./tailscale
  cp "tailscale_${VERSION}_amd64/tailscaled" ./tailscaled
  chmod +x ./tailscale ./tailscaled
  rm -rf "tailscale_${VERSION}_amd64" "${TGZ}"
  echo "Tailscale instalado localmente com sucesso!"
fi

# 2. Inicia o Tailscale em modo "userspace" (necessário para o Render e sem ROOT)
./tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
sleep 5

# 3. Autentica usando a chave que colocamos no painel do Render
./tailscale up --authkey=${TAILSCALE_AUTHKEY}

# Se o script estiver rodando na raiz do repositorio, entra no diretorio correto
if [ -d "cotacao-backend" ]; then
  cd cotacao-backend
fi

# 4. Inicia a sua API (ajuste se o seu comando for diferente)
npm run start
