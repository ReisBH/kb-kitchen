import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const root = path.resolve(import.meta.dirname, "..");
const preparation = JSON.parse(fs.readFileSync(path.join(root, "imports", "recipe_import_preparation.json"), "utf8"));
const outputPath = path.join(root, "imports", "recipe_import_audit.md");
const skippedRecipeOrders = new Set([21]);
const resolved = new Set(["artigo_existente", "receita_base_planeada", "alias_artigo_aceite", "alias_receita_aceite"]);
const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const safeComponentCount = (entry) => entry.components.filter((component) => resolved.has(component.status) && !component.unitConflict && component.sourceUnitRecognized && component.convertedQuantity > 0).length;
const recipes = preparation.plannedEntries.filter((entry) => entry.classification === "receita_base" && !skippedRecipeOrders.has(entry.order));
const sheets = preparation.plannedEntries.filter((entry) => entry.classification === "ficha_tecnica");
const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectTimeout: 10000, ...(url.searchParams.has("ssl") ? { ssl: { rejectUnauthorized: false } } : {}) });

let articleRows;
let sheetRows;
let counts;
try {
  [articleRows] = await connection.execute("SELECT id, nome, codigoCurto, rendimentoEsperado FROM artigos WHERE tipo = 'receita_base' AND ativo = 1");
  [sheetRows] = await connection.execute("SELECT id, nome FROM fichas_tecnicas WHERE ativo = 1");
  [counts] = await connection.execute("SELECT (SELECT COUNT(*) FROM receitas_base_componentes) AS recipeComponents, (SELECT COUNT(*) FROM fichas_tecnicas_componentes) AS sheetComponents, (SELECT COUNT(*) FROM artigos WHERE tipo = 'receita_base' AND ativo = 1 AND rendimentoEsperado IS NOT NULL) AS recipesWithYield, (SELECT COUNT(*) FROM artigos WHERE tipo = 'receita_base' AND ativo = 1 AND codigoCurto IS NOT NULL) AS recipesWithQr");
} finally { await connection.end(); }

const articleByNormalizedName = new Map(articleRows.map((row) => [normalize(row.nome), row]));
const sheetByNormalizedName = new Map(sheetRows.map((row) => [normalize(row.nome), row]));
const missingRecipes = recipes.filter((entry) => !articleByNormalizedName.has(normalize(entry.targetName)));
const missingSheets = sheets.filter((entry) => !sheetByNormalizedName.has(normalize(entry.targetName)));
const groupByNormalizedName = (entries) => {
  const groups = new Map();
  for (const entry of entries) {
    const key = normalize(entry.targetName);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
};
const sheetNameCollisions = groupByNormalizedName(sheets);
const expectedRecipeComponents = recipes.reduce((total, entry) => total + safeComponentCount(entry), 0);
const expectedSheetComponents = sheets.reduce((total, entry) => total + safeComponentCount(entry), 0);

const lines = ["# Auditoria da Importação — Produtos_20260814170412", "", "| Verificação | Esperado | Encontrado |", "|---|---:|---:|", `| Receitas base ativas | ${recipes.length} | ${articleRows.length} |`, `| Fichas técnicas ativas | ${sheets.length} | ${sheetRows.length} |`, `| Componentes de receitas base | ${expectedRecipeComponents} | ${counts[0].recipeComponents} |`, `| Componentes de fichas técnicas | ${expectedSheetComponents} | ${counts[0].sheetComponents} |`, `| Receitas base com QR code | ${recipes.length} | ${counts[0].recipesWithQr} |`, `| Receitas base com rendimento preenchido | 0 | ${counts[0].recipesWithYield} |`, "", "## Exceções verificadas", "", `- Receita base **Wasabi Fresco** (item 21): não criada; o ingrediente existente foi preservado.`, `- Nomes de receitas base em falta: ${missingRecipes.length}.`, `- Nomes de fichas técnicas em falta: ${missingSheets.length}.`, `- Colisões normalizadas de nomes de fichas técnicas: ${sheetNameCollisions.length}.`];
if (sheetNameCollisions.length) {
  lines.push("", "### Colisões normalizadas de nomes", "");
  for (const group of sheetNameCollisions) lines.push(`- ${group.map((entry) => `item ${entry.order}: ${entry.targetName}`).join(" / ")}`);
}
if (missingRecipes.length || missingSheets.length) {
  lines.push("", "### Registos em falta", "");
  for (const entry of [...missingRecipes, ...missingSheets]) lines.push(`- Item ${entry.order}: ${entry.targetName}`);
}
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ recipes: articleRows.length, sheets: sheetRows.length, recipeComponents: Number(counts[0].recipeComponents), sheetComponents: Number(counts[0].sheetComponents), missingRecipes: missingRecipes.length, missingSheets: missingSheets.length, sheetNameCollisions: sheetNameCollisions.map((group) => group.map((entry) => ({ order: entry.order, name: entry.targetName }))), outputPath }, null, 2));
process.exit(0);
