import { describe, expect, it } from "vitest";
import { calcularDataVencimento, normalizarFaturaGemini, numeroFatura } from "./faturasGemini";

describe("Normalização de fatura Gemini", () => {
  it("normaliza valores portugueses, IVA por linha e vencimento calculado", () => {
    const fatura = normalizarFaturaGemini({
      fornecedor: "Makro",
      dataEmissao: "10/08/2026",
      condicoesPagamento: "30 dias",
      valorTotal: "1.234,50 €",
      linhas: [{ descricao: "Arroz", quantidade: "5", unidade: "kg", precoPorUnidade: "12,30", taxaIva: "6", valorIva: "3,69", valorLinha: "61,50", confianca: "alta" }],
    });

    expect(numeroFatura("1.234,50 €")).toBe(1234.5);
    expect(calcularDataVencimento("2026-08-10", "30 dias")).toBe("2026-09-09");
    expect(fatura.dataVencimento).toBe("2026-09-09");
    expect(fatura.dataVencimentoCalculada).toBe(true);
    expect(fatura.linhas[0]).toMatchObject({ precoPorUnidade: 12.3, taxaIva: 6, valorLinha: 61.5 });
  });
});
