import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const projectRoot = path.resolve(import.meta.dirname, "..");
const classificationPath = path.join(projectRoot, "imports", "Produtos_20260814170412_classificacoes.md");
const blocksPath = "/home/ubuntu/excel_products_recipe_blocks.json";
const acceptedAliasesPath = path.join(projectRoot, "imports", "recipe_component_aliases_accepted.json");
const proposalPath = path.join(projectRoot, "imports", "recipe_import_preparation.json");
const unresolvedPath = path.join(projectRoot, "imports", "recipe_import_unresolved.md");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bsemi[\s-]*elaborad[oa]\b/g, "")
    .replace(/\bgranel\b/g, "")
    .replace(/\bde\s+campo\b/g, "")
    .replace(/\bfresco\b/g, "")
    .replace(/\blimpo\b/g, "")
    .replace(/\bcongelado\b/g, "")
    .replace(/\bbiologico\b/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseClassification(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const fields = line.split("|").map((field) => field.trim());
      const decision = fields[5];
      const rename = decision.match(/(?:importar como|renomear para)\s+"([^"]+)"/i)?.[1] ?? null;
      const classification = decision.startsWith("Receita Base")
        ? "receita_base"
        : decision.startsWith("Ficha Técnica")
          ? "ficha_tecnica"
          : decision.startsWith("Ingrediente")
            ? "ingrediente"
            : "nao_inserir";

      return {
        order: Number(fields[1]),
        sourceCode: fields[2],
        sourceName: fields[3],
        family: fields[4],
        decision,
        classification,
        targetName: rename ?? fields[3],
      };
    });
}

function convertSourceUnit(quantity, unitSource) {
  const sourceUnit = normalize(unitSource);
  const numericQuantity = Number(quantity ?? 0);

  if (["kg", "kilograma", "kilogramas"].includes(sourceUnit)) {
    return { quantity: numericQuantity * 1000, unit: "g", recognized: true };
  }
  if (["lt", "l", "litro", "litros"].includes(sourceUnit)) {
    return { quantity: numericQuantity * 1000, unit: "ml", recognized: true };
  }
  if (["unidade", "un", "unidades"].includes(sourceUnit)) {
    return { quantity: numericQuantity, unit: "un", recognized: true };
  }
  return { quantity: numericQuantity, unit: unitSource || "desconhecida", recognized: false };
}

function recipeUnit(name) {
  const liquidPattern = /\b(molho|salsa|caldo|dashi|sopa|marinada|vinagrete|ponzu|nikiri|tare|sukiyaki|soja|oleo|azeite|vinagre|sumo|agua|leite|cremoso)\b/i;
  return liquidPattern.test(name) ? "ml" : "g";
}

function tokenScore(left, right) {
  const leftTokens = new Set(normalize(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function buildIndex(items, getName) {
  const index = new Map();
  for (const item of items) {
    const key = normalize(getName(item));
    if (!key) continue;
    const values = index.get(key) ?? [];
    values.push(item);
    index.set(key, values);
  }
  return index;
}

const classification = parseClassification(fs.readFileSync(classificationPath, "utf8"));
const blocks = JSON.parse(fs.readFileSync(blocksPath, "utf8"));
const acceptedAliases = fs.existsSync(acceptedAliasesPath)
  ? JSON.parse(fs.readFileSync(acceptedAliasesPath, "utf8")).accepted
  : {};
const blocksByCode = new Map(blocks.map((block) => [String(block.source_code), block]));
const approvedRecipes = classification.filter((entry) => entry.classification === "receita_base");
const approvedSheets = classification.filter((entry) => entry.classification === "ficha_tecnica");
const ingredientReview = classification.filter((entry) => entry.classification === "ingrediente");

const databaseUrl = new URL(process.env.DATABASE_URL);
const connectionConfig = {
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.replace(/^\//, ""),
  connectTimeout: 10_000,
  enableKeepAlive: false,
};
if (databaseUrl.searchParams.has("ssl") || databaseUrl.searchParams.has("tls")) {
  connectionConfig.ssl = { rejectUnauthorized: false };
}

const connection = await mysql.createConnection(connectionConfig);
let articles;
try {
  [articles] = await connection.execute(
    "SELECT id, nome, tipo, categoria, unidadeBase, ativo FROM artigos WHERE ativo = 1 ORDER BY nome"
  );
} finally {
  await connection.end();
}

const recipeBySourceName = buildIndex(approvedRecipes, (recipe) => recipe.sourceName);
const recipeByTargetName = buildIndex(approvedRecipes, (recipe) => recipe.targetName);
const sheetBySourceName = buildIndex(approvedSheets, (sheet) => sheet.sourceName);
const sheetByTargetName = buildIndex(approvedSheets, (sheet) => sheet.targetName);
const articlesByName = buildIndex(articles, (article) => article.nome);

function resolveComponent(component, parentRecipe) {
  const sourceName = component.name;
  const normalized = normalize(sourceName);
  const converted = convertSourceUnit(component.quantity, component.unit_source);
  const plannedRecipeMatches = [...(recipeBySourceName.get(normalized) ?? []), ...(recipeByTargetName.get(normalized) ?? [])];
  const distinctRecipeMatches = [...new Map(plannedRecipeMatches.map((item) => [item.order, item])).values()];
  const articleMatches = articlesByName.get(normalized) ?? [];
  const plannedSheetMatches = [
    ...(sheetBySourceName.get(normalized) ?? []),
    ...(sheetByTargetName.get(normalized) ?? []),
  ];
  const distinctSheetMatches = [...new Map(plannedSheetMatches.map((item) => [item.order, item])).values()];

  let status = "sem_correspondencia";
  let target = null;
  let targetUnit = null;
  let candidates = [];

  if (distinctRecipeMatches.length === 1) {
    target = distinctRecipeMatches[0];
    status = target.order === parentRecipe.order ? "auto_referencia" : "receita_base_planeada";
    targetUnit = recipeUnit(target.targetName);
  } else if (distinctRecipeMatches.length > 1) {
    status = "receita_base_ambigua";
    candidates = distinctRecipeMatches.map((item) => ({ name: item.targetName, classification: item.classification }));
  } else if (articleMatches.length === 1) {
    target = articleMatches[0];
    status = "artigo_existente";
    targetUnit = target.unidadeBase;
  } else if (articleMatches.length > 1) {
    status = "artigo_ambiguo";
    candidates = articleMatches.map((item) => ({ id: item.id, name: item.nome, type: item.tipo }));
  } else if (distinctSheetMatches.length > 0) {
    status = "referencia_ficha_tecnica";
    candidates = distinctSheetMatches.map((item) => ({ name: item.targetName, classification: item.classification }));
  } else if (acceptedAliases[sourceName]?.referenceType === "article") {
    const alias = acceptedAliases[sourceName];
    const article = articles.find((item) => item.id === alias.referenceId);
    if (article) {
      target = article;
      targetUnit = article.unidadeBase;
      status = "alias_artigo_aceite";
    } else {
      status = "alias_artigo_invalido";
    }
  } else if (acceptedAliases[sourceName]?.referenceType === "planned_recipe") {
    const alias = acceptedAliases[sourceName];
    const recipe = approvedRecipes.find((item) => item.order === alias.referenceId);
    if (recipe) {
      target = recipe;
      targetUnit = recipeUnit(recipe.targetName);
      status = "alias_receita_aceite";
    } else {
      status = "alias_receita_invalido";
    }
  } else {
    candidates = articles
      .map((article) => ({ id: article.id, name: article.nome, type: article.tipo, score: tokenScore(sourceName, article.nome) }))
      .filter((candidate) => candidate.score >= 0.5)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 3);
  }

  const unitConflict = Boolean(targetUnit && converted.recognized && targetUnit !== converted.unit);

  return {
    sourceName,
    sourceQuantity: Number(component.quantity ?? 0),
    sourceUnit: component.unit_source,
    sourceCost: component.cost,
    convertedQuantity: converted.quantity,
    convertedUnit: converted.unit,
    sourceUnitRecognized: converted.recognized,
    status,
    target: target
      ? ["artigo_existente", "alias_artigo_aceite"].includes(status)
        ? { id: target.id, name: target.nome, type: target.tipo, unit: target.unidadeBase }
        : { order: target.order, name: target.targetName, type: "receita_base", unit: targetUnit }
      : null,
    candidates,
    unitConflict,
  };
}

const plannedEntries = [...approvedRecipes, ...approvedSheets]
  .sort((a, b) => a.order - b.order)
  .map((entry) => {
    const block = blocksByCode.get(String(entry.sourceCode));
    if (!block) {
      return { ...entry, error: "Bloco de origem não encontrado", components: [] };
    }
    const components = block.components.map((component) => resolveComponent(component, entry));
    return {
      ...entry,
      purchasePrice: block.purchase_price,
      sourceFamily: block.family,
      components,
    };
  });

const unresolved = plannedEntries.flatMap((entry) =>
  entry.components
    .filter((component) => !["artigo_existente", "receita_base_planeada", "alias_artigo_aceite", "alias_receita_aceite"].includes(component.status))
    .map((component) => ({
      order: entry.order,
      targetName: entry.targetName,
      classification: entry.classification,
      component,
    }))
);

const unitConflicts = plannedEntries.flatMap((entry) =>
  entry.components
    .filter((component) => component.unitConflict)
    .map((component) => ({ order: entry.order, targetName: entry.targetName, component }))
);

const resolvedStatuses = new Set([
  "artigo_existente",
  "receita_base_planeada",
  "alias_artigo_aceite",
  "alias_receita_aceite",
]);
const componentsSafelyMatched = plannedEntries.flatMap((entry) =>
  entry.components.filter((component) => resolvedStatuses.has(component.status) && !component.unitConflict)
);
const entriesWithoutSafeComponents = plannedEntries.filter((entry) =>
  entry.components.length > 0 && !entry.components.some((component) => resolvedStatuses.has(component.status) && !component.unitConflict)
);

const summary = {
  sourceBlocks: blocks.length,
  classifiedRows: classification.length,
  recipesBaseToCreate: approvedRecipes.length,
  technicalSheetsToCreate: approvedSheets.length,
  ingredientsForReview: ingredientReview.map((item) => ({ order: item.order, sourceName: item.sourceName })),
  excluded: classification.filter((entry) => entry.classification === "nao_inserir").length,
  activeArticles: articles.length,
  totalComponents: plannedEntries.reduce((total, entry) => total + entry.components.length, 0),
  directArticleMatches: plannedEntries.reduce((total, entry) => total + entry.components.filter((component) => component.status === "artigo_existente").length, 0),
  plannedRecipeMatches: plannedEntries.reduce((total, entry) => total + entry.components.filter((component) => component.status === "receita_base_planeada").length, 0),
  acceptedArticleAliases: plannedEntries.reduce((total, entry) => total + entry.components.filter((component) => component.status === "alias_artigo_aceite").length, 0),
  acceptedRecipeAliases: plannedEntries.reduce((total, entry) => total + entry.components.filter((component) => component.status === "alias_receita_aceite").length, 0),
  safelyMatchedComponents: componentsSafelyMatched.length,
  excludedComponentsForSafety: plannedEntries.reduce((total, entry) => total + entry.components.length, 0) - componentsSafelyMatched.length,
  recipesWithoutSafeComponents: entriesWithoutSafeComponents.filter((entry) => entry.classification === "receita_base").length,
  sheetsWithoutSafeComponents: entriesWithoutSafeComponents.filter((entry) => entry.classification === "ficha_tecnica").length,
  unresolvedByStatus: Object.fromEntries(
    [...new Set(unresolved.map((item) => item.component.status))]
      .sort()
      .map((status) => [status, unresolved.filter((item) => item.component.status === status).length])
  ),
  unitConflicts: unitConflicts.length,
};

const proposal = {
  generatedAt: new Date().toISOString(),
  summary,
  articleCatalog: articles.map((article) => ({
    id: article.id,
    name: article.nome,
    type: article.tipo,
    category: article.categoria,
    unit: article.unidadeBase,
  })),
  plannedEntries,
  unresolved,
  unitConflicts,
};
fs.writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);

const unresolvedRows = unresolved
  .slice(0, 500)
  .map((item) => {
    const candidates = item.component.candidates.map((candidate) => candidate.name).join(", ") || "—";
    return `| ${item.order} | ${item.targetName} | ${item.component.sourceName} | ${item.component.status} | ${candidates} |`;
  })
  .join("\n");

const report = `# Preparação da Importação — Produtos_20260814170412\n\n` +
  `| Indicador | Valor |\n|---|---:|\n` +
  `| Receitas base aprovadas | ${summary.recipesBaseToCreate} |\n` +
  `| Fichas técnicas aprovadas | ${summary.technicalSheetsToCreate} |\n` +
  `| Ingredientes para revisão | ${summary.ingredientsForReview.length} |\n` +
  `| Componentes analisados | ${summary.totalComponents} |\n` +
  `| Correspondências diretas a artigos | ${summary.directArticleMatches} |\n` +
  `| Correspondências a receitas base planeadas | ${summary.plannedRecipeMatches} |\n` +
  `| Componentes pendentes ou incompatíveis | ${unresolved.length} |\n` +
  `| Conflitos de unidade a rever | ${summary.unitConflicts} |\n\n` +
  `## Componentes pendentes ou incompatíveis\n\n` +
  `| Item | Registo a importar | Componente Excel | Estado | Candidatos |\n|---:|---|---|---|---|\n` +
  `${unresolvedRows || "| — | — | — | Sem pendências | — |"}\n`;

fs.writeFileSync(unresolvedPath, report);
console.log(JSON.stringify({ summary, proposalPath, unresolvedPath }, null, 2));
process.exit(0);
