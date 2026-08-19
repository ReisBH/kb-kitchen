import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { correspondePesquisaAproximada } from "../client/src/lib/pesquisaAproximada";

const router = (filename: string) => fs.readFileSync(path.resolve(import.meta.dirname, "routers", filename), "utf8");

describe("famílias e pesquisa aproximada", () => {
  it("encontra nomes com acentos, fragmentos e pequenos erros de escrita", () => {
    expect(correspondePesquisaAproximada("Tártaro Toro", "tartaro")).toBe(true);
    expect(correspondePesquisaAproximada("Sashimi de Salmão", "sashimi salmao")).toBe(true);
    expect(correspondePesquisaAproximada("Cozinha Quente", "cozihna")).toBe(true);
    expect(correspondePesquisaAproximada("Tártaro Toro", "pastel")).toBe(false);
  });

  it("mantém a família controlada e os procedimentos de edição nos routers", () => {
    expect(router("receitas.ts")).toContain("familia: z.enum([\"Cozinha Quente\", \"Sushi\", \"Pastelaria\"])");
    expect(router("receitas.ts")).toContain("atualizar: protectedProcedure");
    expect(router("fichas.ts")).toContain("familia: z.enum([\"Cozinha Quente\", \"Sushi\", \"Pastelaria\"])" );
    expect(router("fichas.ts")).toContain("atualizar: protectedProcedure");
  });
});
