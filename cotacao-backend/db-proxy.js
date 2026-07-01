import net from 'net';

const LOCAL_PORT = 5433; // Porta local em loopback
const REMOTE_HOST = '100.101.103.87'; // IP do banco na rede Tailscale
const REMOTE_PORT = 5432;
const SOCKS_HOST = '127.0.0.1';
const SOCKS_PORT = 1055; // Porta SOCKS5 do Tailscale

const server = net.createServer((clientSocket) => {
  console.log('[DB-PROXY] Nova conexão local de banco de dados iniciada.');

  const socksSocket = net.connect(SOCKS_PORT, SOCKS_HOST, () => {
    // 1. Envia handshake do protocolo SOCKS5 (Sem Autenticação)
    socksSocket.write(Buffer.from([0x05, 0x01, 0x00]));
  });

  let state = 0; // 0: Handshake, 1: Conexão, 2: Ativo

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
        console.error('[DB-PROXY] Falha no handshake do SOCKS5.');
        clientSocket.destroy();
        socksSocket.destroy();
      }
    } else if (state === 1) {
      if (data[0] === 0x05 && data[1] === 0x00) {
        state = 2;
        console.log('[DB-PROXY] Conexão TCP tunelada com o banco de dados via VPN com sucesso!');
        // Repassa eventuais bytes iniciais recebidos
        if (data.length > 10) {
          clientSocket.write(data.subarray(10));
        }
        // Conecta as duas pontas da transmissão de forma transparente
        clientSocket.pipe(socksSocket);
        socksSocket.pipe(clientSocket);
      } else {
        console.error('[DB-PROXY] Falha ao conectar ao banco de dados remoto via SOCKS5, código:', data[1]);
        clientSocket.destroy();
        socksSocket.destroy();
      }
    }
  });

  clientSocket.on('error', (err) => {
    console.warn('[DB-PROXY] Erro no socket cliente:', err.message);
    socksSocket.destroy();
  });

  socksSocket.on('error', (err) => {
    console.warn('[DB-PROXY] Erro no socket SOCKS:', err.message);
    clientSocket.destroy();
  });
});

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`[DB-PROXY] Rodando em 127.0.0.1:${LOCAL_PORT} -> ${REMOTE_HOST}:${REMOTE_PORT} via SOCKS5`);
});
