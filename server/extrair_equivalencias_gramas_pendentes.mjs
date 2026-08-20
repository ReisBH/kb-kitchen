import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const root = path.resolve(import.meta.dirname, "..");
const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectTimeout: 10000,
  ...(url.searchParams.has("ssl") ? { ssl: { rejectUnauthorized: false } } : {}),
});

const [rows] = await connection.execute(`
  SELECT origem, registo, componente, quantidade, usos
  FROM (
    SELECT 'Receita Base' AS origem, r.nome AS registo, a.nome AS componente,
           c.quantidade, 1 AS usos
    FROM receitas_base_componentes c
    JOIN artigos r ON r.id = c.receitaId
    JOIN artigos a ON a.id = c.componenteId
    WHERE c.unidade = 'g' AND a.unidadeBase = 'un' AND LOWER(a.nome) NOT LIKE '%bambu%'
    UNION ALL
    SELECT 'Ficha Técnica' AS origem, f.nome AS registo, a.nome AS componente,
           c.quantidade, 1 AS usos
    FROM fichas_tecnicas_componentes c
    JOIN fichas_tecnicas f ON f.id = c.fichaId
    JOIN artigos a ON a.id = c.componenteId
    WHERE c.unidade = 'g' AND a.unidadeBase = 'un' AND LOWER(a.nome) NOT LIKE '%bambu%'
  ) pendentes
  ORDER BY componente, origem, registo
`);

const grouped = new Map();
for (const row of rows) {
  const current = grouped.get(row.componente) ?? [];
  current.push(row);
  grouped.set(row.componente, current);
}

const lines = [
  "# Equivalências em gramas pendentes de confirmação",
  "",
  "Estes artigos têm stock nativo em `un`, mas foram pedidos em referências de receita/ficha em `g`. É necessária uma equivalência real (gramas por unidade) para que o custo por grama seja fisicamente correto.",
  "",
  "| Artigo | Referências em g | Utilizações |", "|---|---|---:|",
];
for (const [component, uses] of grouped) {
  const refs = uses.map((item) => `${item.origem}: ${item.registo} (${Number(item.quantidade).toFixed(4)} g)`).join("<br>");
  lines.push(`| ${component} | ${refs} | ${uses.length} |`);
}

const report = path.join(root, "imports", "equivalencias_gramas_pendentes.md");
fs.writeFileSync(report, `${lines.join("\n")}\n`);
await connection.end();
console.log(JSON.stringify({ artigos: grouped.size, referencias: rows.length, report }, null, 2));
