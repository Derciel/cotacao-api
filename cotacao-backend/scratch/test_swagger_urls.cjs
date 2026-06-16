const fs = require('fs');

const urls = [
  'https://api.swaggerhub.com/apis/siegcom/sieg-api-suite-completa/1.0/swagger.json',
  'https://api.swaggerhub.com/apis/siegcom/OAuth/engine/swagger.json',
  'https://api.swaggerhub.com/apis/siegcom/NewJWT/1.0.0/swagger.json',
  'https://api.swaggerhub.com/apis/siegcom/BaixarXml/1.0.0/swagger.json',
  'https://api.swaggerhub.com/apis/siegcom/BaixarXmls/1.0.0/swagger.json',
  'https://api.swaggerhub.com/apis/siegcom/ContarXmls/1.0.0/swagger.json',
  'https://api.swaggerhub.com/apis/siegcom/BuscarXmlsNSU/1.0.0/swagger.json'
];

async function testUrls() {
  for (const url of urls) {
    console.log(`Testando URL: ${url}`);
    try {
      const res = await fetch(url);
      console.log(`  Status: ${res.status} ${res.statusText}`);
      if (res.status === 200) {
        const data = await res.json();
        const filename = url.split('/').slice(-3, -1).join('_') + '.json';
        const outputPath = `e:\\Projetos Finalizados\\projeto-cotacao-2025\\cotacao-backend\\scratch\\${filename}`;
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`  -> Salvo com sucesso em: ${outputPath}`);
      }
    } catch (e) {
      console.error(`  Erro:`, e.message);
    }
  }
}

testUrls();
