import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

async function run() {
  const rootPath = path.resolve('..');
  const files = fs.readdirSync(rootPath).filter(f => f.endsWith('.xlsx'));
  
  console.log('Arquivos Excel encontrados:', files);

  for (const fileName of files) {
    console.log(`\n--- Lendo Planilha: ${fileName} ---`);
    const filePath = path.join(rootPath, fileName);
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      console.log('Total de linhas:', data.length);
      console.log('Primeiras 3 linhas:', JSON.stringify(data.slice(0, 3), null, 2));
    } catch (e) {
      console.error(`Erro ao ler ${fileName}:`, e.message);
    }
  }
}

run();
