import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const apply = process.argv.includes("--apply");
const root = path.resolve(import.meta.dirname, "..");
const inputPath = path.join(root, "imports", "recipe_import_preparation.json");
const exceptionPath = path.join(root, "imports", "recipe_import_exceptions_final.md");
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const resolved = new Set(["artigo_existente", "receita_base_planeada", "alias_artigo_aceite", "alias_receita_aceite"]);
const skippedRecipeOrders = new Map([[21, "Mantido o ingrediente existente Wasabi fresco; não criar receita base duplicada."]]);
const skippedRecipeFallbackArticleIds = new Map([[21, 151]]);

const isLiquid = (name) => /\b(molho|salsa|caldo|dashi|sopa|marinada|vinagrete|ponzu|nikiri|tare|sukiyaki|soja|oleo|azeite|vinagre|sumo|agua|leite|cremoso|sushi[ -]?su)\b/i.test(name);
const baseUnit = (name) => (isLiquid(name) ? "ml" : "g");
const code = () => crypto.randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 8);

const safeComponents = (entry) => entry.components.filter((component) => resolved.has(component.status) && !component.unitConflict && component.sourceUnitRecognized && component.convertedQuantity > 0);
const exceptions = [];
for (const entry of input.plannedEntries) {
  for (const component of entry.components) {
    if (!safeComponents(entry).includes(component)) {
      exceptions.push({ order: entry.order, name: entry.targetName, component: component.sourceName, status: component.status, unitConflict: component.unitConflict });
    }
  }
}

const planned = input.plannedEntries;
const recipes = planned.filter((entry) => entry.classification === "receita_base" && !skippedRecipeOrders.has(entry.order));
const sheets = planned.filter((entry) => entry.classification === "ficha_tecnica");
const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectTimeout: 10000, ...(url.searchParams.has("ssl") ? { ssl: { rejectUnauthorized: false } } : {}) });

const recipeIds = new Map();
const existingCodes = new Set((await connection.execute("SELECT codigoCurto FROM artigos WHERE codigoCurto IS NOT NULL"))[0].map((row) => row.codigoCurto));
const getCode = () => { let value; do value = code(); while (existingCodes.has(value)); existingCodes.add(value); return value; };
const findArticle = async (name) => { const [rows] = await connection.execute("SELECT id, tipo FROM artigos WHERE nome = ? AND ativo = 1 LIMIT 1", [name]); return rows[0] ?? null; };
const findSheet = async (name) => { const [rows] = await connection.execute("SELECT id FROM fichas_tecnicas WHERE nome = ? AND ativo = 1 LIMIT 1", [name]); return rows[0] ?? null; };
const resolvedComponentId = (component) => component.target.id ?? recipeIds.get(component.target.order) ?? skippedRecipeFallbackArticleIds.get(component.target.order);

const summary = { mode: apply ? "apply" : "dry-run", recipesCreated: 0, recipesReused: 0, recipesSkipped: skippedRecipeOrders.size, sheetsCreated: 0, sheetsReused: 0, recipeComponentsCreated: 0, sheetComponentsCreated: 0, recipeComponentsPlanned: 0, sheetComponentsPlanned: 0, componentsExcluded: exceptions.length, emptyRecipes: recipes.filter((entry) => safeComponents(entry).length === 0).length, emptySheets: sheets.filter((entry) => safeComponents(entry).length === 0).length };

try {
  if (apply) await connection.beginTransaction();
  for (const recipe of recipes) {
    const existing = await findArticle(recipe.targetName);
    if (existing) {
      if (existing.tipo !== "receita_base") throw new Error(`Colisão de nome: ${recipe.targetName} já existe como ${existing.tipo}`);
      recipeIds.set(recipe.order, existing.id); summary.recipesReused++; continue;
    }
    if (!apply) { recipeIds.set(recipe.order, -recipe.order); summary.recipesCreated++; continue; }
    const [result] = await connection.execute("INSERT INTO artigos (nome, codigoCurto, tipoEtiqueta, tipo, categoria, unidadeBase, custoMedioPonderado, ativo) VALUES (?, ?, 'ambas', 'receita_base', ?, ?, 0, 1)", [recipe.targetName, getCode(), recipe.sourceFamily ?? recipe.family, baseUnit(recipe.targetName)]);
    recipeIds.set(recipe.order, result.insertId); summary.recipesCreated++;
  }
  for (const recipe of recipes) {
    const recipeId = recipeIds.get(recipe.order);
    if (!apply || recipeId < 0) {
      for (const component of safeComponents(recipe)) {
        const componentId = resolvedComponentId(component);
        if (!componentId) throw new Error(`Componente sem destino resolvido em ${recipe.targetName}: ${component.sourceName}`);
        summary.recipeComponentsPlanned++;
      }
      continue;
    }
    const [rows] = await connection.execute("SELECT COUNT(*) AS total FROM receitas_base_componentes WHERE receitaId = ?", [recipeId]);
    if (Number(rows[0].total) > 0) continue;
    for (const [order, component] of safeComponents(recipe).entries()) {
      const componentId = resolvedComponentId(component);
      if (!componentId || componentId < 0) throw new Error(`Componente sem id resolvido em ${recipe.targetName}: ${component.sourceName}`);
      await connection.execute("INSERT INTO receitas_base_componentes (receitaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)", [recipeId, componentId, component.convertedQuantity.toFixed(4), component.convertedUnit, order]);
      summary.recipeComponentsCreated++;
      summary.recipeComponentsPlanned++;
    }
  }
  for (const sheet of sheets) {
    const existing = await findSheet(sheet.targetName);
    let sheetId;
    if (existing) { sheetId = existing.id; summary.sheetsReused++; }
    else if (!apply) { sheetId = -sheet.order; summary.sheetsCreated++; }
    else { const [result] = await connection.execute("INSERT INTO fichas_tecnicas (nome, secaoMenu, ativo, explodir_receitas) VALUES (?, ?, 1, 'auto')", [sheet.targetName, sheet.sourceFamily ?? sheet.family]); sheetId = result.insertId; summary.sheetsCreated++; }
    if (!apply || sheetId < 0) {
      for (const component of safeComponents(sheet)) {
        const componentId = resolvedComponentId(component);
        if (!componentId) throw new Error(`Componente sem destino resolvido em ${sheet.targetName}: ${component.sourceName}`);
        summary.sheetComponentsPlanned++;
      }
      continue;
    }
    const [rows] = await connection.execute("SELECT COUNT(*) AS total FROM fichas_tecnicas_componentes WHERE fichaId = ?", [sheetId]);
    if (Number(rows[0].total) > 0) continue;
    for (const [order, component] of safeComponents(sheet).entries()) {
      const componentId = resolvedComponentId(component);
      if (!componentId || componentId < 0) throw new Error(`Componente sem id resolvido em ${sheet.targetName}: ${component.sourceName}`);
      await connection.execute("INSERT INTO fichas_tecnicas_componentes (fichaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)", [sheetId, componentId, component.convertedQuantity.toFixed(4), component.convertedUnit, order]);
      summary.sheetComponentsCreated++;
      summary.sheetComponentsPlanned++;
    }
  }
  if (apply) await connection.commit();
} catch (error) {
  if (apply) await connection.rollback();
  throw error;
} finally { await connection.end(); }

const lines = ["# Exceções da Importação de Receitas e Fichas", "", "Estas linhas não foram importadas como componentes por decisão do utilizador: apenas correspondências seguras são criadas. Não foram criados ingredientes novos e não foram inseridos rendimentos provisórios.", "", "| Item | Registo | Componente Excel | Estado | Conflito de unidade |", "|---:|---|---|---|---|"];
for (const item of exceptions) lines.push(`| ${item.order} | ${item.name} | ${item.component} | ${item.status} | ${item.unitConflict ? "Sim" : "Não"} |`);
lines.push("", "## Registos sem componentes seguros", "", `- Receitas base: ${summary.emptyRecipes}`, `- Fichas técnicas: ${summary.emptySheets}`, "", "Os rendimentos esperados das receitas base foram deixados em branco para preenchimento manual posterior.");
lines.push("", "## Registos não criados por decisão confirmada", "");
for (const [order, reason] of skippedRecipeOrders) lines.push(`- Item ${order}: ${reason}`);
fs.writeFileSync(exceptionPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ ...summary, exceptionPath }, null, 2));
process.exit(0);
