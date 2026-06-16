import { ZipArchive } from 'archiver';
import { Writable } from 'stream';

const generateZip = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const chunks = [];
      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });
      
      stream.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });
      
      stream.on('error', reject);
      
      archive.pipe(stream);
      
      // Adicionar arquivo fictício
      archive.append(Buffer.from('Hello world from ZipArchive!'), { name: 'test.txt' });
      
      await archive.finalize();
    } catch (e) {
      reject(e);
    }
  });
};

generateZip()
  .then(buffer => {
    console.log('ZIP generated successfully! Buffer length:', buffer.length);
    console.log('Is it a valid ZIP? (magic bytes PK\\x03\\x04):', buffer.slice(0, 4).toString('hex') === '504b0304');
  })
  .catch(e => {
    console.error('Error generating ZIP:', e.message);
  });
