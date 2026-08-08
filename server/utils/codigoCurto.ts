import { randomBytes } from 'crypto';

// Crockford Base32 alphabet — no ambiguous chars (no I, L, O, U)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function gerarCodigoCurtoSync(len = 6): string {
  const buf = randomBytes(len);
  let result = '';
  for (let i = 0; i < len; i++) result += ALPHABET[buf[i] % 32];
  return result;
}

export function gerarCodigoLoteSync(len = 8): string {
  return gerarCodigoCurtoSync(len);
}

