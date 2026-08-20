import { describe, it, expect } from "vitest";

// Pesos introduzidos na interface em gramas; preço de compra em €/kg.
function calcularRendimento(pesoBrutoGramas: number, pesoLimpoGramas: number, precoKgBruto: number, valorAparas: number = 0) {
  const pesoBrutoKg = pesoBrutoGramas / 1000;
  const aproveitamentoPct = (pesoLimpoGramas / pesoBrutoGramas) * 100;
  const perdaPct = 100 - aproveitamentoPct;
  const custoTotal = pesoBrutoKg * precoKgBruto;
  const custoLiquido = custoTotal - valorAparas;
  const custoRealPorKg = custoLiquido / (pesoLimpoGramas / 1000);
  const sobrecusto = custoRealPorKg - precoKgBruto;
  return { aproveitamentoPct, perdaPct, custoRealPorKg, sobrecusto };
}

describe("cálculo de rendimento de proteínas", () => {
  it("calcula aproveitamento e custo real correctamente", () => {
    // 5 000 g de bacalhau bruto a 9,50 €/kg → 3 000 g limpo
    const r = calcularRendimento(5000, 3000, 9.50);
    expect(r.aproveitamentoPct).toBeCloseTo(60, 1);
    expect(r.perdaPct).toBeCloseTo(40, 1);
    expect(r.custoRealPorKg).toBeCloseTo(15.833, 2);
    expect(r.sobrecusto).toBeCloseTo(6.333, 2);
  });

  it("desconta valor das aparas do custo total", () => {
    // 5 000 g de vitela a 12 €/kg → 3 500 g limpo, aparas valem 2 €
    const r = calcularRendimento(5000, 3500, 12, 2);
    const custoEsperado = (5 * 12 - 2) / 3.5;
    expect(r.custoRealPorKg).toBeCloseTo(custoEsperado, 3);
  });

  it("aproveitamento de 100% resulta em custo real igual ao preço bruto", () => {
    const r = calcularRendimento(1000, 1000, 10);
    expect(r.aproveitamentoPct).toBe(100);
    expect(r.custoRealPorKg).toBe(10);
    expect(r.sobrecusto).toBe(0);
  });
});
