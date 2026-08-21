import mysql from 'mysql2/promise';
import { writeFile } from 'node:fs/promises';

const menu = [
  ['Menu Degustação Kabuki', 125, 'pessoa'],
  ['Menu Kabuki Ampliado', 150, 'pessoa'],
  ['Menu Degustação Vegan', 100, 'pessoa'],
  ['Menu Vegan Ampliado', 120, 'pessoa'],
  ['Ostra Natural', 5, 'un'],
  ['Miso Shiru', 8, 'dose'], ['Wakame Kyuri Su', 8, 'dose'], ['Nasu no Miso', 19, 'dose'],
  ['Gyoza Kabuki', 16, '4 un'], ['Gyoza Carabineiro', 36, '4 un'],
  ['Peixe Branco', 36, 'dose'], ['Sake', 34, 'dose'], ['Akami', 44, 'dose'],
  ['Degustação de Atum', 52, 'dose'], ['Moriawase', 48, 'dose'], ['Kabuki Sashimi', 120, '2 pessoas'],
  ['Kaisendon', 42, 'dose'], ['Unadon', 36, 'dose'],
  ['Sake Estrelado', 34, 'dose'], ['Maguro Estrelado', 38, 'dose'], ['Maguro Picante', 36, 'dose'],
  ['Abacate Estrelado', 26, 'dose'], ['Toro', 52, 'dose'],
  ['Bulhão Pato', 28, 'dose'], ['Ponzu', 34, 'dose'], ['Akami Caviar', 36, 'dose'],
  ['Pa Amb Tomaquet', 42, 'dose'], ['Hotate', 38, 'dose'], ['Maguro Tonnato', 37, 'dose'], ['Carabineiro', 44, 'dose'],
  ['Yasai Sushi', 41, 'dose'], ['Edomae Sushi', 72, 'dose'], ['Kabuki Sushi', 80, 'dose'],
  ['Ovo Trufa', 8, 'un'], ['Ovo Caviar', 16, 'un'], ['Belota', 8, 'un'], ['Unagi Kabayaki', 8, 'un'],
  ['Chutoro Dijon', 8, 'un'], ['Toro Flambé', 9, 'un'], ['Gunkan Negitoro Caviar', 18, 'un'],
  ['Hambúrguer', 8, 'un'], ['Bife Tártaro', 8, 'un'], ['Gyutataki Chimichurri', 8, 'un'],
  ['Kagoshima Nigiri', 18, 'un'], ['Carabineiro Nigiri', 32, 'un'],
  ['Negitoro Maki', 14, 'dose'], ['Unagi Futomaki', 18, 'dose'], ['Soft-Shell Crab', 23, 'dose'],
  ['Tempura Ebi Futomaki', 23, 'dose'], ['Yasai Maki', 14, 'dose'],
  ['Ikura Temaki', 14, 'un'], ['Sake Temaki', 14, 'un'], ['Bochecha Temaki', 14, 'un'],
  ['Unagi Temaki', 14, 'un'], ['Maguro Picante Temaki', 14, 'un'],
  ['Yasai Tempura', 28, 'dose'], ['Moriawase Tempura', 32, 'dose'], ['Ebi Tempura', 36, 'dose'],
  ['Tori no Shoga', 30, 'dose'], ['Sakana Yaki', 34, 'dose'], ['Gindara no Miso', 42, 'dose'],
  ['Minhota Vazia', 0.5, 'g'], ['Costela Wagyu', 42, 'dose'], ['Niku-Take Nabe', 52, 'dose'],
  ['Kagoshima', 1.1, 'g'], ['Gohan', 6, 'dose'], ['Shari', 6, 'dose'], ['Edamame', 8, 'dose'],
  ['Kimchi', 10, 'dose'], ['Takenabe', 18, 'dose'],
];

const aliases = new Map([
  ['ostra natural', ['ostra', 'ostras']],
  ['kabuki sashimi', ['kabuki']],
  ['bulhao pato', ['bulhao pato']],
  ['pa amb tomaquet', ['pa amb tomaquet', 'pa amb tomàquet']],
  ['kagoshima nigiri', ['kagoshima']],
  ['carabineiro nigiri', ['carabineiro']],
  ['ikura temaki', ['ikura']],
  ['sake temaki', ['sake']],
  ['bochecha temaki', ['bochecha']],
  ['unagi temaki', ['unagi']],
  ['maguro picante temaki', ['maguro picante']],
  ['yasai tempura', ['yasai']],
  ['moriawase tempura', ['moriawase']],
  ['ebi tempura', ['ebi']],
  ['kagoshima', ['kagoshima']],
]);

function normalizar(value) {
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pontuar(menuName, fichaName) {
  const a = normalizar(menuName);
  const b = normalizar(fichaName);
  if (a === b) return 1;
  const alternativas = aliases.get(a) ?? [];
  if (alternativas.some(alias => normalizar(alias) === b)) return 0.99;
  if (a.length >= 5 && (b.includes(a) || a.includes(b))) return 0.9;
  const ta = new Set(a.split(' ').filter(t => t.length > 2));
  const tb = new Set(b.split(' ').filter(t => t.length > 2));
  const inter = [...ta].filter(t => tb.has(t)).length;
  const uniao = new Set([...ta, ...tb]).size || 1;
  return inter / uniao;
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [fichas] = await connection.execute(
  'SELECT id, nome, precoVenda, estadoPublicacao, ativo FROM fichas_tecnicas WHERE ativo = 1 ORDER BY nome'
);
await connection.end();

const resultados = menu.map(([nomeMenu, preco, unidadePreco]) => {
  const candidatos = fichas
    .map(ficha => ({ ...ficha, score: Number(pontuar(nomeMenu, ficha.nome).toFixed(3)) }))
    .filter(ficha => ficha.score >= 0.25)
    .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome))
    .slice(0, 5);
  const melhor = candidatos[0] ?? null;
  const seguro = melhor && melhor.score >= 0.9 && (candidatos[1]?.score ?? 0) < melhor.score;
  return { nomeMenu, preco, unidadePreco, melhor, candidatos, seguro };
});

await writeFile('/home/ubuntu/economato/imports/menu_2026_cruzamento_bruto.json', JSON.stringify(resultados, null, 2));
console.log(JSON.stringify({ total_menu: menu.length, resultados }, null, 2));
