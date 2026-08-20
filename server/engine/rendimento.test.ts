import { describe, it, expect } from "vitest";

import { calcularCustoRendimento, criarChavesIdempotenciaRendimento } from "./rendimento";

describe("cálculo de rendimento de proteínas", () => {
  it("calcula aproveitamento e custo real correctamente", () => {
    // 5 000 g de bacalhau bruto a 9,50 €/kg → 3 000 g limpo
    const r = calcularCustoRendimento({ pesoBrutoGramas: 5000, pesoLimpoGramas: 3000, precoKgBruto: 9.50 });
    expect(r.aproveitamentoPct).toBeCloseTo(60, 1);
    expect(r.perdaPct).toBeCloseTo(40, 1);
    expect(r.custoRealPorKg).toBeCloseTo(15.833, 2);
    expect(r.sobrecusto).toBeCloseTo(6.333, 2);
  });

  it("desconta valor das aparas do custo total", () => {
    // 5 000 g de vitela a 12 €/kg → 3 500 g limpo, aparas valem 2 €
    const r = calcularCustoRendimento({ pesoBrutoGramas: 5000, pesoLimpoGramas: 3500, precoKgBruto: 12, valorAparas: 2 });
    const custoEsperado = (5 * 12 - 2) / 3.5;
    expect(r.custoRealPorKg).toBeCloseTo(custoEsperado, 3);
  });

  it("aproveitamento de 100% resulta em custo real igual ao preço bruto", () => {
    const r = calcularCustoRendimento({ pesoBrutoGramas: 1000, pesoLimpoGramas: 1000, precoKgBruto: 10 });
    expect(r.aproveitamentoPct).toBe(100);
    expect(r.custoRealPorKg).toBe(10);
    expect(r.sobrecusto).toBe(0);
  });

  it("calcula o custo por grama sem erro de fator mil", () => {
    const r = calcularCustoRendimento({ pesoBrutoGramas: 1000, pesoLimpoGramas: 800, precoKgBruto: 10 });
    expect(r.custoTotalCompra).toBe(10);
    expect(r.custoRealPorKg).toBe(12.5);
    expect(r.custoPorGrama).toBeCloseTo(0.0125, 8);
    expect(r.custoLiquido).toBeCloseTo(800 * r.custoPorGrama, 8);
  });

  it("rejeita pesos limpos fisicamente impossíveis e aparas acima do custo", () => {
    expect(() => calcularCustoRendimento({ pesoBrutoGramas: 800, pesoLimpoGramas: 1000, precoKgBruto: 10 })).toThrow(/peso limpo/i);
    expect(() => calcularCustoRendimento({ pesoBrutoGramas: 1000, pesoLimpoGramas: 800, precoKgBruto: 10, valorAparas: 11 })).toThrow(/aparas/i);
  });

  it("deriva chaves determinísticas para impedir duplicação do teste e dos dois movimentos", () => {
    const primeira = criarChavesIdempotenciaRendimento("rendimento-0001");
    const repetida = criarChavesIdempotenciaRendimento("rendimento-0001");
    expect(repetida).toEqual(primeira);
    expect(primeira).toEqual({
      teste: "rendimento-0001",
      saida: "rendimento-0001:saida",
      entrada: "rendimento-0001:entrada",
    });
    expect(() => criarChavesIdempotenciaRendimento("curta")).toThrow(/chave/i);
  });
});
