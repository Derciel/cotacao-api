import net from 'net';

const LOCAL_PORT = 5433; // Porta local em loopback
const REMOTE_HOST = '100.101.103.87'; // IP do banco na rede Tailscale
const REMOTE_PORT = 5432;
const SOCKS_HOST = '127.0.0.1';
const SOCKS_PORT = 1055; // Porta SOCKS5 do Tailscale

// Configurações de retry com backoff exponencial
const MAX_RETRIES = 20;        // Aumentado para mais tentativas, mas mais rápidas
const INITIAL_DELAY_MS = 500;  // Começa com 500ms (antes 2s)
const MAX_DELAY_MS = 5000;     // Máximo de 5s entre tentativas (antes 15s)

function connectWithRetry(clientSocket, attempt = 0) {
  if (clientSocket.destroyed) return;

  const delay = Math.min(INITIAL_DELAY_MS * Math.pow(1.5, attempt), MAX_DELAY_MS);

  if (attempt === 0) {
    console.log('[DB-PROXY] Nova conexão local de banco de dados iniciada.');
  } else {
    console.log(`[DB-PROXY] Tentativa ${attempt}/${MAX_RETRIES} em ${(delay / 1000).toFixed(1)}s...`);
  }

  const socksSocket = net.connect(SOCKS_PORT, SOCKS_HOST, () => {
    // 1. Envia handshake do protocolo SOCKS5 (Sem Autenticação)
    socksSocket.write(Buffer.from([0x05, 0x01, 0x00]));
  });

  socksSocket.setTimeout(10000); // Timeout de 10s por tentativa

  let state = 0; // 0: Handshake, 1: Conexão, 2: Ativo

  const onFailure = (reason) => {
    socksSocket.destroy();
    if (attempt < MAX_RETRIES) {
      console.warn(`[DB-PROXY] Falha (${reason}). Aguardando ${(delay / 1000).toFixed(1)}s para reconexão VPN...`);
      setTimeout(() => connectWithRetry(clientSocket, attempt + 1), delay);
    } else {
      console.error(`[DB-PROXY] Todas as ${MAX_RETRIES} tentativas esgotadas. Encerrando conexão.`);
      clientSocket.destroy();
    }
  };

  socksSocket.on('timeout', () => onFailure('timeout de 10s'));

  socksSocket.on('data', (data) => {
    if (state === 0) {
      if (data[0] === 0x05 && data[1] === 0x00) {
        state = 1;
        // 2. Solicita conexão de túnel com o banco de dados remoto
        const hostParts = REMOTE_HOST.split('.').map(Number);
        const req = Buffer.alloc(10);
        req[0] = 0x05; // Versão SOCKS5
        req[1] = 0x01; // Comando CONNECT
        req[2] = 0x00; // Reservado
        req[3] = 0x01; // Tipo IPv4
        req[4] = hostParts[0];
        req[5] = hostParts[1];
        req[6] = hostParts[2];
        req[7] = hostParts[3];
        req.writeUInt16BE(REMOTE_PORT, 8);
        socksSocket.write(req);
      } else {
        onFailure('handshake SOCKS5 rejeitado');
      }
    } else if (state === 1) {
      if (data[0] === 0x05 && data[1] === 0x00) {
        state = 2;
        socksSocket.setTimeout(0); // Remove timeout após conexão estabelecida
        console.log('[DB-PROXY] Conexão TCP tunelada com o banco de dados via VPN com sucesso!');
        // Repassa eventuais bytes iniciais recebidos
        if (data.length > 10) {
          clientSocket.write(data.subarray(10));
        }
        // Conecta as duas pontas da transmissão de forma transparente
        clientSocket.pipe(socksSocket);
        socksSocket.pipe(clientSocket);
      } else {
        onFailure(`SOCKS5 código ${data[1]}`);
      }
    }
  });

  clientSocket.on('error', (err) => {
    console.warn('[DB-PROXY] Erro no socket cliente:', err.message);
    socksSocket.destroy();
  });

  socksSocket.on('error', (err) => {
    if (state < 2) {
      onFailure(err.message);
    } else {
      console.warn('[DB-PROXY] Erro no socket SOCKS (ativo):', err.message);
      clientSocket.destroy();
    }
  });
}

const server = net.createServer((clientSocket) => {
  connectWithRetry(clientSocket, 0);
});

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`[DB-PROXY] Rodando em 127.0.0.1:${LOCAL_PORT} -> ${REMOTE_HOST}:${REMOTE_PORT} via SOCKS5`);
});
