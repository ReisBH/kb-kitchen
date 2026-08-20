import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const preparation = JSON.parse(fs.readFileSync(path.join(root, "imports", "recipe_import_preparation.json"), "utf8"));
const targets = new Set([
  "Gohan Semi-elaborado", "Guarnición batata dulce Semi-elaborado", "Jengibre Oroshi Semi-elaborado",
  "Koroke Bechamel Semi-elaborado", "Lirio Limpo", "Marinada de Atún Semi-elaborado",
  "Marinada de caballa Semi-elaborado", "Marinada de Torino Semi-elaborado", "Marinada Sake no miso Semi-elaborado",
  "Mayonesa Kimchi Semi-elaborado", "Molho Bulhao Pato Semi-Elaborado", "Molho Classico de Gyosa Semi-Elaborado",
  "Momiji Oroshi Semi-elaborado", "Pure de Apionabo Semi-elaborado", "Recheio Gyosa Porco", "Salmão Limpo",
  "Salsa Adobo Semi-elaborado", "Salsa Chipotle Semi-elaborado", "Sirope Milky Oolong Semi-elaborado", "Take Dashi Semi-elaborado",
]);

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").replace(/\b(semi elaborado|semi elaborada|semi elaborado|fresco|fresca|de|da|do|das|dos|el|la)\b/g, " ")
  .replace(/\s+/g, " ").trim();
const tokens = (value) => new Set(normalize(value).split(" ").filter(Boolean));
const similarity = (a, b) => {
  const aa = tokens(a), bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  const common = [...aa].filter((word) => bb.has(word)).length;
  return common / Math.max(aa.size, bb.size);
};

const catalog = preparation.articleCatalog ?? [];
const entries = preparation.plannedEntries.filter((entry) => targets.has(entry.targetName));
const lines = [
  "# Propostas de ligação para receitas sem custo",
  "",
  "Relatório determinístico gerado para revisão. Apenas itens marcados como **inequívocos** podem ser associados automaticamente; os restantes requerem confirmação.",
];

for (const entry of entries) {
  lines.push("", `## ${entry.targetName}`, "", "| Componente Excel | Qtd. convertida | Estado atual | Melhor candidato | Confiança | Decisão |", "|---|---:|---|---|---:|---|");
  for (const component of entry.components) {
    const direct = component.target ? [component.target] : [];
    const candidates = [...direct, ...(component.candidates ?? [])];
    const additional = catalog
      .map((article) => ({ id: article.id, name: article.name, unit: article.unit, score: similarity(component.sourceName, article.name) }))
      .filter((candidate) => candidate.score >= 0.75)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const best = [...candidates, ...additional]
      .map((candidate) => ({ ...candidate, score: candidate.score ?? similarity(component.sourceName, candidate.name) }))
      .sort((a, b) => b.score - a.score)[0];
    const score = Number(best?.score ?? 0);
    const unequivocal = Boolean(best && score >= 0.9 && !component.unitConflict && component.convertedQuantity > 0);
    lines.push(`| ${component.sourceName} | ${component.convertedQuantity ?? 0} ${component.convertedUnit ?? ""} | ${component.status} | ${best ? `${best.name} (ID ${best.id})` : "—"} | ${score.toFixed(2)} | ${unequivocal ? "inequívoco" : "revisar"} |`);
  }
}

const out = path.join(root, "imports", "propostas_componentes_sem_custo.md");
fs.writeFileSync(out, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ entries: entries.length, report: out }, null, 2));
