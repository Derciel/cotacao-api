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

# 2. Inicia o Tailscale em modo "userspace" direcionando o socket e estado para a pasta /tmp (gravavel sem ROOT)
./tailscaled --tun=userspace-networking --socks5-server=localhost:1055 --socket=/tmp/tailscaled.sock --state=/tmp/tailscale.state &
sleep 5

# 3. Autentica apontando para o socket customizado e a chave do Render
./tailscale --socket=/tmp/tailscaled.sock up --authkey=${TAILSCALE_AUTHKEY} --hostname=cotacao-api-render

echo "Aguardando 10 segundos para o túnel estabilizar as rotas..."
sleep 10
echo "Pronto para iniciar serviços locais."

# Se o script estiver rodando na raiz do repositorio, entra no diretorio correto
if [ -d "cotacao-backend" ]; then
  cd cotacao-backend
fi

# 4. Inicia o proxy local de banco de dados TCP-over-SOCKS5 em segundo plano
node db-proxy.js &
sleep 2

# 5. Inicia a sua API
npm run start
