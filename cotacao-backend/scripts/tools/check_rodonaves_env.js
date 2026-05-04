import 'dotenv/config';
const keys = Object.keys(process.env).filter(k => k.startsWith('RODONAVES'));
console.log('Rodonaves Keys found:', keys);
