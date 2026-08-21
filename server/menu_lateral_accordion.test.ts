import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, itemEstaAtivo, obterSecaoAtiva } from "../client/src/components/EconomatoLayout";

describe("Menu lateral agrupado", () => {
  it("preserva as 17 rotas em cinco secções operacionais", () => {
    expect(NAV_SECTIONS).toHaveLength(5);
    expect(NAV_SECTIONS.map((secao) => secao.label)).toEqual([
      "Catálogo & produção",
      "Stock & movimentos",
      "Vendas",
      "Automação OCR",
      "Administração & sistema",
    ]);
    expect(NAV_SECTIONS.flatMap((secao) => secao.items).map((item) => item.href)).toEqual([
      "/ingredientes", "/fornecedores", "/rendimento", "/receitas", "/fichas",
      "/movimentos-manual", "/movimentos", "/inventario", "/alertas",
      "/vendas", "/mapa-pos", "/ocr/faturas", "/ocr/fecho-caixa",
      "/aprovacoes", "/supervisao", "/etiquetas", "/utilizadores",
    ]);
  });

  it("mantém ativa e expande automaticamente a secção da rota atual", () => {
    expect(itemEstaAtivo("/ocr/faturas", "/ocr/faturas?documento=12")).toBe(true);
    expect(obterSecaoAtiva("/ocr/faturas")).toBe("automacao-ocr");
    expect(obterSecaoAtiva("/aprovacoes")).toBe("administracao-sistema");
  });
});
