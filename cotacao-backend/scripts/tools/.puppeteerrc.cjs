const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Define o diretório de cache dentro da pasta do projeto
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};