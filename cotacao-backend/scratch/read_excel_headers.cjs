const fs = require('fs');
const XLSX = require('xlsx');

const files = [
  'e:/Projetos Finalizados/projeto-cotacao-2025/Relatorio_Padrao_04-05-2026_15-38.xlsx',
  'e:/Projetos Finalizados/projeto-cotacao-2025/Relatorio_Padrao_04-05-2026_16-52 - flexobox.xlsx',
  'e:/Projetos Finalizados/projeto-cotacao-2025/Relatorio_Padrao_04-05-2026_16-52 - l.log.xlsx'
];

files.forEach(filePath => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log('----------------------------------------------------');
    console.log('File:', filePath.split('/').pop());
    console.log('Sheet Name:', sheetName);
    console.log('Total Rows:', data.length);
    if (data.length > 0) {
      console.log('Headers/First Row Keys:', Object.keys(data[0]));
      console.log('First Row sample:', JSON.stringify(data[0]));
    }
  } catch (e) {
    console.error('Error reading excel:', filePath, e.message);
  }
});
