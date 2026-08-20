import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const apply = process.argv.includes("--apply");
const root = path.resolve(import.meta.dirname, "..");
const reportPath = path.join(root, "imports", "rendimentos_provisorios_auditoria.md");
const preparation = JSON.parse(fs.readFileSync(path.join(root, "imports", "recipe_import_preparation.json"), "utf8"));
const plannedRecipeByName = new Map(preparation.plannedEntries.filter((entry) => entry.classification === "receita_base").map((entry) => [entry.targetName, entry]));
const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectTimeout: 10_000,
  ...(url.searchParams.has("ssl") ? { ssl: { rejectUnauthorized: false } } : {}),
});

const [recipes] = await connection.execute(`
  SELECT id, nome, unidadeBase, rendimentoEsperado, custoMedioPonderado
  FROM artigos
  WHERE tipo = 'receita_base' AND ativo = 1
  ORDER BY id
`);
const [components] = await connection.execute(`
  SELECT c.receitaId, c.componenteId, c.quantidade, c.unidade,
         a.tipo AS componenteTipo, a.custoMedioPonderado
  FROM receitas_base_componentes c
  JOIN artigos a ON a.id = c.componenteId AND a.ativo = 1
  ORDER BY c.receitaId, c.ordem
`);

const recipeById = new Map(recipes.map((recipe) => [Number(recipe.id), recipe]));
const componentsByRecipe = new Map();
for (const component of components) {
  const id = Number(component.receitaId);
  const list = componentsByRecipe.get(id) ?? [];
  list.push(component);
  componentsByRecipe.set(id, list);
}

const memo = new Map();
const calcular = (recipeId, stack = new Set()) => {
  if (memo.has(recipeId)) return memo.get(recipeId);
  const recipe = recipeById.get(recipeId);
  if (!recipe || stack.has(recipeId)) return { rendimento: 0, custoLote: 0, custoUnitario: 0, motivo: "ciclo_ou_receita_ausente" };
  const nextStack = new Set(stack);
  nextStack.add(recipeId);
  const list = componentsByRecipe.get(recipeId) ?? [];
  const unit = recipe.unidadeBase;
  const rendimentoCompativel = list
    .filter((component) => component.unidade === unit)
    .reduce((sum, component) => sum + Number(component.quantidade), 0);
  const rendimentoPorSomaTotal = list.reduce((sum, component) => sum + Number(component.quantidade), 0);
  const receitaPlaneada = plannedRecipeByName.get(recipe.nome);
  const rendimentoExcel = (receitaPlaneada?.components ?? []).reduce((sum, component) => sum + Number(component.convertedQuantity ?? 0), 0);
  const rendimento = rendimentoCompativel > 0 ? rendimentoCompativel : rendimentoPorSomaTotal > 0 ? rendimentoPorSomaTotal : rendimentoExcel;
  let custoLote = 0;
  for (const component of list) {
    let custoUnitario = Number(component.custoMedioPonderado ?? 0);
    if (component.componenteTipo === "receita_base") {
      custoUnitario = calcular(Number(component.componenteId), nextStack).custoUnitario;
    }
    custoLote += Number(component.quantidade) * custoUnitario;
  }
  const result = {
    rendimento,
    custoLote,
    custoUnitario: rendimento > 0 ? custoLote / rendimento : 0,
    motivo: rendimentoCompativel > 0
      ? "soma_componentes_mesma_unidade"
      : rendimentoPorSomaTotal > 0
        ? "soma_numerica_provisoria_de_unidades_mistas"
        : rendimentoExcel > 0
          ? "soma_componentes_excel_nao_vinculados"
          : "sem_componentes_no_excel",
  };
  memo.set(recipeId, result);
  return result;
};

const results = recipes.map((recipe) => ({ recipe, ...calcular(Number(recipe.id)) }));
if (apply) {
  await connection.beginTransaction();
  try {
    for (const result of results) {
      if (result.rendimento <= 0) continue;
      await connection.execute(
        "UPDATE artigos SET rendimentoEsperado = ?, custoMedioPonderado = ? WHERE id = ? AND tipo = 'receita_base'",
        [result.rendimento.toFixed(3), result.custoUnitario.toFixed(6), result.recipe.id],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

const lines = [
  "# Auditoria de Rendimentos Provisórios",
  "",
  `Modo: **${apply ? "aplicado" : "simulação"}**.`,
  "",
  "O rendimento provisório é a soma das quantidades dos componentes. Quando existirem componentes na mesma unidade de produção, é usada essa soma; caso contrário, é usada a soma numérica provisória das quantidades vinculadas ou, quando não há componente seguro gravado, das quantidades originais do Excel, conforme solicitado. O custo médio é o custo do lote dividido por esse rendimento, seguindo receitas base vinculadas até aos ingredientes.",
  "",
  "| Receita | Unidade | Rendimento provisório | Custo por unidade | Estado |",
  "|---|---|---:|---:|---|",
];
for (const result of results) {
  lines.push(`| ${result.recipe.nome} | ${result.recipe.unidadeBase} | ${result.rendimento.toFixed(3)} | ${result.custoUnitario.toFixed(6)} € | ${result.motivo} |`);
}
const semRendimento = results.filter((result) => result.rendimento <= 0);
lines.push("", "## Pendências", "", `- Receitas atualizadas ou prontas a atualizar: ${results.length - semRendimento.length}`, `- Receitas sem soma compatível: ${semRendimento.length}`);
if (semRendimento.length) lines.push(...semRendimento.map((result) => `- ${result.recipe.nome} (${result.recipe.unidadeBase})`));
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", total: results.length, atualizaveis: results.length - semRendimento.length, semRendimento: semRendimento.length, reportPath }, null, 2));
await connection.end();
