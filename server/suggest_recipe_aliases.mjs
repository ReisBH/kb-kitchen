import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const preparationPath = path.join(projectRoot, "imports", "recipe_import_preparation.json");
const outputPath = path.join(projectRoot, "imports", "recipe_component_alias_suggestions.md");
const proposal = JSON.parse(fs.readFileSync(preparationPath, "utf8"));

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(semi|elaborado|elaborada|fresco|fresca|limpo|limpa|inteiro|inteira|congelado|congelada|granel|biologico|biologica)\b/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|lt|l|ml|un|und|folhas?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenScore(left, right) {
  const leftTokens = new Set(normalize(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function levenshtein(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return Math.max(a.length, b.length);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function similarity(left, right) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  const token = tokenScore(left, right);
  const distance = levenshtein(left, right);
  const character = normalizedLeft || normalizedRight
    ? 1 - distance / Math.max(normalizedLeft.length, normalizedRight.length)
    : 0;
  const containment = normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft) ? 1 : 0;
  return Math.max(token, character, containment * 0.9);
}

const unmatched = proposal.unresolved.filter((item) => item.component.status === "sem_correspondencia");
const grouped = new Map();
for (const item of unmatched) {
  const key = item.component.sourceName;
  const entry = grouped.get(key) ?? { name: key, occurrences: 0, units: new Set(), examples: new Set() };
  entry.occurrences += 1;
  entry.units.add(item.component.convertedUnit);
  entry.examples.add(item.targetName);
  grouped.set(key, entry);
}

const candidates = proposal.articleCatalog;
const lines = [];
lines.push("# Sugestões de Aliases — Importação Produtos_20260814170412", "");
lines.push("Esta lista é apenas uma preparação determinística. As sugestões devem ser revistas antes de criar componentes na base de dados.", "");
lines.push("| Ocorrências | Componente Excel | Unidade convertida | Melhor artigo sugerido | Tipo | Unidade | Pontuação |", "|---:|---|---|---|---|---|---:|");

const suggestions = [...grouped.values()]
  .map((entry) => {
    const ranked = candidates
      .map((candidate) => ({ candidate, score: similarity(entry.name, candidate.name) }))
      .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
    return { ...entry, ranked };
  })
  .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));

for (const suggestion of suggestions) {
  const best = suggestion.ranked[0];
  const safeCandidate = best.score >= 0.72 ? best.candidate : null;
  lines.push(`| ${suggestion.occurrences} | ${suggestion.name} | ${[...suggestion.units].join(", ")} | ${safeCandidate?.name ?? "—"} | ${safeCandidate?.type ?? "—"} | ${safeCandidate?.unit ?? "—"} | ${(best.score * 100).toFixed(0)}% |`);
}

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ uniqueUnmatchedComponents: suggestions.length, outputPath }, null, 2));
