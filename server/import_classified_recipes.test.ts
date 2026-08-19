import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const preparation = JSON.parse(fs.readFileSync(path.join(root, "imports", "recipe_import_preparation.json"), "utf8"));
const importScript = fs.readFileSync(path.join(root, "server", "import_classified_recipes.mjs"), "utf8");

describe("preparação da importação classificada", () => {
  it("mantém as contagens aprovadas e a exceção do Wasabi Fresco", () => {
    expect(preparation.summary.recipesBaseToCreate).toBe(105);
    expect(preparation.summary.technicalSheetsToCreate).toBe(128);
    expect(preparation.plannedEntries.find((entry: { order: number }) => entry.order === 21)?.targetName).toBe("Wasabi Fresco");
    expect(preparation.plannedEntries.find((entry: { order: number }) => entry.order === 23)).toBeUndefined();
    expect(preparation.plannedEntries.find((entry: { order: number }) => entry.order === 294)?.targetName).toBe("Tártaro Toro");
    expect(importScript).toContain("skippedRecipeOrders");
    expect(importScript).toContain("[21,");
  });

  it("só considera seguros componentes resolvidos, sem conflito de unidade e com destino definido", () => {
    const safeStatuses = new Set(["artigo_existente", "receita_base_planeada", "alias_artigo_aceite", "alias_receita_aceite"]);
    const safeComponents = preparation.plannedEntries.flatMap((entry: { components: unknown[] }) => entry.components)
      .filter((component: { status: string; unitConflict: boolean }) => safeStatuses.has(component.status) && !component.unitConflict);

    expect(safeComponents.length).toBe(preparation.summary.safelyMatchedComponents);
    expect(safeComponents.every((component: { target: { id?: number; order?: number } }) => component.target?.id || component.target?.order)).toBe(true);
  });

  it("não insere rendimentos provisórios no script de importação", () => {
    expect(importScript).not.toContain("rendimentoEsperado");
    expect(importScript).toContain("resolved.has(component.status) && !component.unitConflict");
  });
});
