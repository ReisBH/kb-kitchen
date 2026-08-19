import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const root = path.resolve(import.meta.dirname, "..");
const input = JSON.parse(fs.readFileSync(path.join(root, "imports", "recipe_import_preparation.json"), "utf8"));
const outputPath = path.join(root, "imports", "recipe_import_preflight_collisions.md");
const skippedRecipeOrders = new Set([21]);
const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectTimeout: 10000, ...(url.searchParams.has("ssl") ? { ssl: { rejectUnauthorized: false } } : {}) });

const collisions = [];
try {
  for (const entry of input.plannedEntries.filter((entry) => entry.classification === "receita_base" && !skippedRecipeOrders.has(entry.order))) {
    const [rows] = await connection.execute("SELECT id, nome, tipo FROM artigos WHERE nome = ? AND ativo = 1 LIMIT 1", [entry.targetName]);
    if (rows[0] && rows[0].tipo !== "receita_base") collisions.push({ order: entry.order, sourceName: entry.sourceName, targetName: entry.targetName, existingId: rows[0].id, existingType: rows[0].tipo });
  }
  for (const entry of input.plannedEntries.filter((entry) => entry.classification === "ficha_tecnica")) {
    const [rows] = await connection.execute("SELECT id, nome FROM fichas_tecnicas WHERE nome = ? AND ativo = 1 LIMIT 1", [entry.targetName]);
    if (rows[0]) collisions.push({ order: entry.order, sourceName: entry.sourceName, targetName: entry.targetName, existingId: rows[0].id, existingType: "ficha_tecnica" });
  }
} finally { await connection.end(); }

const lines = ["# Pré-verificação de Colisões — Importação", "", "| Item | Nome de origem | Nome final | Registo existente | ID |", "|---:|---|---|---|---:|"];
for (const item of collisions) lines.push(`| ${item.order} | ${item.sourceName} | ${item.targetName} | ${item.existingType} | ${item.existingId} |`);
if (!collisions.length) lines.push("| — | — | Sem colisões | — | — |");
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ collisions: collisions.length, outputPath, details: collisions }, null, 2));
process.exit(0);
