import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const preparationPath = path.join(projectRoot, "imports", "recipe_import_preparation.json");
const recommendationsPath = path.join(projectRoot, "imports", "recipe_component_alias_recommendations.json");
const strongerRecommendationsPath = path.join(projectRoot, "imports", "recipe_component_alias_recommendations_gpt5.json");
const outputPath = path.join(projectRoot, "imports", "recipe_component_aliases_accepted.json");

const preparation = JSON.parse(fs.readFileSync(preparationPath, "utf8"));
const recommendations = [
  JSON.parse(fs.readFileSync(recommendationsPath, "utf8")),
  ...(fs.existsSync(strongerRecommendationsPath)
    ? [JSON.parse(fs.readFileSync(strongerRecommendationsPath, "utf8"))]
    : []),
];
const articleById = new Map(preparation.articleCatalog.map((article) => [article.id, article]));
const recipeByOrder = new Map(
  preparation.plannedEntries
    .filter((entry) => entry.classification === "receita_base")
    .map((entry) => [entry.order, entry])
);

function recipeUnit(name) {
  return /\b(molho|salsa|caldo|dashi|sopa|marinada|vinagrete|ponzu|nikiri|tare|sukiyaki|soja|oleo|azeite|vinagre|sumo|agua|leite|cremoso|sushi[ -]?su)\b/i.test(name)
    ? "ml"
    : "g";
}

const overrides = {
  "Arroz Hitomebore Blend": {
    referenceType: "article",
    referenceId: 326,
    referenceName: "Arroz koshihikari",
    rationale: "Confirmação semântica: arroz cru de cultivar, não a receita base Shari.",
  },
};

const accepted = {};
for (const recommendation of recommendations.flatMap((result) => result.recommendations)) {
  if (recommendation.confidence !== "high" || recommendation.reference_type === "NO_MATCH") continue;
  const entry = {
    referenceType: recommendation.reference_type,
    referenceId: recommendation.reference_id,
    referenceName: recommendation.reference_name,
    confidence: recommendation.confidence,
    rationale: recommendation.rationale,
    source: "recomendacao_modelo_alta_confianca",
  };
  if (entry.referenceType === "article") {
    const article = articleById.get(entry.referenceId);
    if (!article) continue;
    entry.unit = article.unit;
  } else {
    const recipe = recipeByOrder.get(entry.referenceId);
    if (!recipe) continue;
    entry.unit = recipeUnit(recipe.targetName);
  }
  accepted[recommendation.source_name] = entry;
}

for (const [sourceName, override] of Object.entries(overrides)) {
  const article = override.referenceType === "article" ? articleById.get(override.referenceId) : null;
  accepted[sourceName] = {
    ...override,
    unit: article?.unit ?? "g",
    confidence: "manual",
    source: "revisao_manual",
  };
}

const deferred = recommendations.flatMap((result) => result.recommendations)
  .filter((recommendation) => !accepted[recommendation.source_name])
  .map((recommendation) => ({
    sourceName: recommendation.source_name,
    occurrences: recommendation.occurrences,
    referenceType: recommendation.reference_type,
    referenceName: recommendation.reference_name,
    confidence: recommendation.confidence,
    rationale: recommendation.rationale,
  }))
  .sort((left, right) => right.occurrences - left.occurrences || left.sourceName.localeCompare(right.sourceName));

fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), accepted, deferred }, null, 2)}\n`
);

console.log(JSON.stringify({ acceptedAliases: Object.keys(accepted).length, deferredAliases: deferred.length, outputPath }, null, 2));
