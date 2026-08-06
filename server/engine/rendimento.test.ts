import { describe, it, expect } from "vitest";

// Funções puras de cálculo de rendimento (extraídas para teste)
function calcularRendimento(pesoBruto: number, pesoLimpo: number, precoKgBruto: number, valorAparas: number = 0) {
  const aproveitamentoPct = (pesoLimpo / pesoBruto) * 100;
  const perdaPct = 100 - aproveitamentoPct;
  const custoTotal = pesoBruto * precoKgBruto;
  const custoLiquido = custoTotal - valorAparas;
  const custoRealPorKg = custoLiquido / pesoLimpo;
  const sobrecusto = custoRealPorKg - precoKgBruto;
  return { aproveitamentoPct, perdaPct, custoRealPorKg, sobrecusto };
}

describe("cálculo de rendimento de proteínas", () => {
  it("calcula aproveitamento e custo real correctamente", () => {
    // 5 kg de bacalhau bruto a 9.50 €/kg → 3 kg limpo
    const r = calcularRendimento(5, 3, 9.50);
    expect(r.aproveitamentoPct).toBeCloseTo(60, 1);
    expect(r.perdaPct).toBeCloseTo(40, 1);
    expect(r.custoRealPorKg).toBeCloseTo(15.833, 2);
    expect(r.sobrecusto).toBeCloseTo(6.333, 2);
  });

  it("desconta valor das aparas do custo total", () => {
    // 5 kg de vitela a 12 €/kg → 3.5 kg limpo, aparas valem 2 €
    const r = calcularRendimento(5, 3.5, 12, 2);
    const custoEsperado = (5 * 12 - 2) / 3.5;
    expect(r.custoRealPorKg).toBeCloseTo(custoEsperado, 3);
  });

  it("aproveitamento de 100% resulta em custo real igual ao preço bruto", () => {
    const r = calcularRendimento(1, 1, 10);
    expect(r.aproveitamentoPct).toBe(100);
    expect(r.custoRealPorKg).toBe(10);
    expect(r.sobrecusto).toBe(0);
  });
});

