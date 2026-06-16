const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const zipPath = 'e:\\Projetos Finalizados\\projeto-cotacao-2025\\cotacao-backend\\scratch\\sieg_xmls.zip';

async function runTest() {
  console.log('=== TESTE DE EXTRAÇÃO EM MEMÓRIA COM ADM-ZIP ===');
  console.log(`Lendo ZIP: ${zipPath}`);

  if (!fs.existsSync(zipPath)) {
    console.error('Arquivo ZIP de teste não encontrado! Execute primeiro o teste de download.');
    return;
  }

  try {
    const buffer = fs.readFileSync(zipPath);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    console.log(`Sucesso ao ler ZIP! Encontrados ${zipEntries.length} arquivos compactados.`);

    for (let i = 0; i < Math.min(zipEntries.length, 3); i++) {
      const entry = zipEntries[i];
      console.log(`\n--- Arquivo ${i + 1}: ${entry.entryName} (${entry.header.size} bytes) ---`);
      
      const xmlContent = entry.getData().toString('utf8');
      console.log('Snippet do XML descompactado:');
      console.log(xmlContent.substring(0, 300) + '...');
      
      // Valida se o conteúdo é um XML válido
      if (xmlContent.includes('<?xml') && xmlContent.includes('<cteProc')) {
        console.log('-> VALIDADO: É um XML de CT-e estruturado perfeitamente!');
      } else {
        console.warn('-> AVISO: O conteúdo descompactado não parece um XML padrão.');
      }
    }
  } catch (err) {
    console.error('Erro ao processar o ZIP na memória:', err.message);
  }
}

runTest();
