import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const nfsToSearch = ['67746', '67745', '67743', '67740', '67739', '67733'];
const rootPath = path.resolve('..');
const files = fs.readdirSync(rootPath).filter(f => f.endsWith('.xlsx'));

for (const fileName of files) {
  const filePath = path.join(rootPath, fileName);
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    console.log(`Planilha: ${fileName}`);
    for (const targetNf of nfsToSearch) {
      const matches = data.filter(row => {
        const rowNf = String(row.Numero || '').replace(/^0+/, '');
        const rowChave = String(row.Chave || '');
        let match = (rowNf === targetNf);
        if (rowChave.length === 44) {
          const nfFromKey = rowChave.substring(25, 34).replace(/^0+/, '');
          if (nfFromKey === targetNf) match = true;
        }
        return match;
      });
      if (matches.length > 0) {
        console.log(`  Match para NF ${targetNf}:`, JSON.stringify(matches, null, 2));
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}
