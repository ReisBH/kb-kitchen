import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("listagem de fichas técnicas", () => {
  it("calcula custos em lotes paralelos para evitar bloqueio em listas grandes", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "routers", "fichas.ts"), "utf8");
    expect(source).toContain("const tamanhoLote = 16");
    expect(source).toContain("Promise.all(rows.slice(inicio, inicio + tamanhoLote)");
  });
});
