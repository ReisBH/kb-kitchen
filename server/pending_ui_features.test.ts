import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = (filename: string) => fs.readFileSync(path.resolve(import.meta.dirname, "..", "client", "src", "pages", filename), "utf8");

describe("funcionalidades pendentes da interface", () => {
  it("mantém os formulários de criação de receitas e fichas ligados às mutações tRPC", () => {
    expect(page("ReceitasBase.tsx")).toContain("trpc.receitas.criar.useMutation");
    expect(page("FichasTecnicas.tsx")).toContain("trpc.fichas.criar.useMutation");
  });

  it("mantém o simulador de food cost, comparador de proteínas e mapa POS configurável", () => {
    expect(page("FichasTecnicas.tsx")).toContain("Simulador de preço");
    expect(page("Rendimento.tsx")).toContain("Comparador de Proteínas");
    expect(page("MapaPos.tsx")).toContain("trpc.ocr.guardarMapaPos.useMutation");
  });
});
