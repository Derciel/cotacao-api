const fs = require('fs');
const path = require('path');

const docPath = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\183811d2-526a-4d3e-9a2e-5f0ed1902a3d\\.system_generated\\steps\\753\\content.md';
const outputPath = 'e:\\Projetos Finalizados\\projeto-cotacao-2025\\cotacao-backend\\scratch\\parsed_sieg_doc.txt';

try {
  const content = fs.readFileSync(docPath, 'utf8');
  
  // Encontrar strings JSON ou URLs da API da SIEG
  const urls = content.match(/https?:\/\/[^\s"'`<>]+/g) || [];
  const uniqueUrls = [...new Set(urls)].filter(url => url.includes('sieg'));
  
  // Remove tags HTML, mas preserva o texto
  const cleanText = content
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const apiInfo = [];
  
  // O SwaggerHub embutido geralmente armazena as APIs em um objeto JSON
  const regex = /"content"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawVal = match[1];
    if (rawVal.includes('API') || rawVal.includes('sieg') || rawVal.includes('docs/')) {
      const decoded = rawVal.replace(/\\u([0-9a-fA-F]{4})/g, (g, m) => String.fromCharCode(parseInt(m, 16)));
      apiInfo.push(decoded);
    }
  }

  let output = `=== URLS DA SIEG ENCONTRADAS ===\n`;
  output += uniqueUrls.join('\n') + '\n\n';
  
  output += `=== BLOCOS DE TEXTO/API ENCONTRADOS NO JSON ===\n`;
  output += apiInfo.join('\n---\n') + '\n\n';
  
  output += `=== TEXTO LIMPO DA PÁGINA ===\n`;
  output += cleanText.slice(0, 20000) + '...\n'; // primeiras 20k letras
  
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log('Documentação parseada com sucesso! Arquivo salvo em:', outputPath);
} catch (error) {
  console.error('Erro ao ler ou parsear o documento:', error);
}
