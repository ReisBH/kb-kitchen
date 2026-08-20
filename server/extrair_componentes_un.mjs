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
  SELECT 'Receita Base' AS tipo_registo, r.id AS registo_id, r.nome AS registo,
         c.ordem, a.id AS componente_id, a.nome AS componente, c.quantidade,
         c.unidade AS unidade_registada, a.unidadeBase AS unidade_nativa
  FROM receitas_base_componentes c
  JOIN artigos r ON r.id = c.receitaId
  JOIN artigos a ON a.id = c.componenteId
  WHERE LOWER(c.unidade) = 'un'
  UNION ALL
  SELECT 'Ficha Técnica' AS tipo_registo, f.id AS registo_id, f.nome AS registo,
         c.ordem, a.id AS componente_id, a.nome AS componente, c.quantidade,
         c.unidade AS unidade_registada, a.unidadeBase AS unidade_nativa
  FROM fichas_tecnicas_componentes c
  JOIN fichas_tecnicas f ON f.id = c.fichaId
  JOIN artigos a ON a.id = c.componenteId
  WHERE LOWER(c.unidade) = 'un'
  ORDER BY tipo_registo, registo, ordem
`);

const byType = new Map();
for (const row of rows) {
  const group = byType.get(row.tipo_registo) ?? [];
  group.push(row);
  byType.set(row.tipo_registo, group);
}

const lines = [
  "# Componentes registados com unidade `un`",
  "",
  `Gerado em ${new Date().toISOString().slice(0, 10)}. Inclui cada componente de receita base e ficha técnica cuja unidade registada é \`un\`.`,
  "",
  "| Total | Registos |",
  "|---:|---|",
  `| ${rows.length} | Componentes com unidade \`un\` |`,
];

for (const [type, items] of byType) {
  lines.push("", `## ${type}`, "", "| Registo | Componente | Quantidade | Unidade registada | Unidade nativa |", "|---|---|---:|---|---|");
  for (const item of items) {
    lines.push(`| ${item.registo} | ${item.componente} | ${Number(item.quantidade).toFixed(4)} | ${item.unidade_registada} | ${item.unidade_nativa ?? "—"} |`);
  }
}

const report = path.join(root, "imports", "componentes_unidades_un.md");
fs.writeFileSync(report, `${lines.join("\n")}\n`);
await connection.end();
console.log(JSON.stringify({ total: rows.length, report }, null, 2));
