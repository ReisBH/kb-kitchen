import mysql from 'mysql2/promise';
import { randomBytes } from 'crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function gerarCodigo(len = 6) {
  const buf = randomBytes(len);
  let result = '';
  for (let i = 0; i < len; i++) result += ALPHABET[buf[i] % 32];
  return result;
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

const [artigos] = await db.execute('SELECT id FROM artigos WHERE codigoCurto IS NULL AND ativo = 1');
console.log(`Found ${artigos.length} artigos without QR code`);

const [existing] = await db.execute('SELECT codigoCurto FROM artigos WHERE codigoCurto IS NOT NULL');
const usedCodes = new Set(existing.map(r => r.codigoCurto));

let count = 0;
for (const artigo of artigos) {
  let codigo;
  do { codigo = gerarCodigo(6); } while (usedCodes.has(codigo));
  usedCodes.add(codigo);
  await db.execute('UPDATE artigos SET codigoCurto = ? WHERE id = ?', [codigo, artigo.id]);
  count++;
}
console.log(`Generated ${count} QR codes successfully`);
await db.end();
