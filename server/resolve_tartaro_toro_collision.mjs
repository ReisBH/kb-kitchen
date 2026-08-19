import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const apply = process.argv.includes("--apply");
const root = path.resolve(import.meta.dirname, "..");
const preparation = JSON.parse(fs.readFileSync(path.join(root, "imports", "recipe_import_preparation.json"), "utf8"));
const target = preparation.plannedEntries.find((entry) => entry.order === 294);
if (!target) throw new Error("Item 294 não encontrado na preparação de importação.");
const safeStatuses = new Set(["artigo_existente", "receita_base_planeada", "alias_artigo_aceite", "alias_receita_aceite"]);
const fallbackArticleIds = new Map([[21, 151]]);
const safeComponents = target.components.filter((component) => safeStatuses.has(component.status) && !component.unitConflict && component.sourceUnitRecognized && component.convertedQuantity > 0);
const componentId = (component) => component.target?.id ?? fallbackArticleIds.get(component.target?.order);
const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectTimeout: 10000, ...(url.searchParams.has("ssl") ? { ssl: { rejectUnauthorized: false } } : {}) });

try {
  const [existingRows] = await connection.execute("SELECT id, nome FROM fichas_tecnicas WHERE nome = ? AND ativo = 1", [target.targetName]);
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", existingSheetsToReplace: existingRows, targetName: target.targetName, safeComponents: safeComponents.map((component) => ({ sourceName: component.sourceName, componenteId: componentId(component), quantidade: component.convertedQuantity, unidade: component.convertedUnit })) }, null, 2));
    process.exit(0);
  }
  await connection.beginTransaction();
  for (const existing of existingRows) {
    await connection.execute("DELETE FROM fichas_tecnicas_componentes WHERE fichaId = ?", [existing.id]);
    await connection.execute("DELETE FROM fichas_tecnicas WHERE id = ?", [existing.id]);
  }
  const [result] = await connection.execute("INSERT INTO fichas_tecnicas (nome, secaoMenu, ativo, explodir_receitas) VALUES (?, ?, 1, 'auto')", [target.targetName, target.sourceFamily ?? target.family]);
  for (const [ordem, component] of safeComponents.entries()) {
    const id = componentId(component);
    if (!id) throw new Error(`Componente sem destino seguro: ${component.sourceName}`);
    await connection.execute("INSERT INTO fichas_tecnicas_componentes (fichaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)", [result.insertId, id, component.convertedQuantity.toFixed(4), component.convertedUnit, ordem]);
  }
  await connection.commit();
  console.log(JSON.stringify({ mode: "apply", removedSheetIds: existingRows.map((row) => row.id), createdSheetId: result.insertId, name: target.targetName, componentsCreated: safeComponents.length }, null, 2));
} catch (error) {
  if (apply) await connection.rollback();
  throw error;
} finally { await connection.end(); }
