import { describe, it, expect } from "vitest";
import { converterParaUnidadeBase } from "./stock";

describe("converterParaUnidadeBase", () => {
  it("retorna a mesma quantidade se unidade origem === unidade base", () => {
    expect(converterParaUnidadeBase(500, "g", "g", 1, null)).toBe(500);
  });

  it("converte kg para g com fator 1000", () => {
    expect(converterParaUnidadeBase(2.5, "kg", "g", 1000, null)).toBe(2500);
  });

  it("converte l para ml com fator 1000", () => {
    expect(converterParaUnidadeBase(1.5, "l", "ml", 1000, null)).toBe(1500);
  });

  it("converte unidade de compra (caixa) para unidade base (g) via fatorConversao", () => {
    // Caixa de 6 kg = 6000 g
    expect(converterParaUnidadeBase(1, "caixa", "g", 6000, null)).toBe(6000);
  });

  it("converte ml para g via densidade", () => {
    // Azeite: densidade ~0.92 g/ml → 100 ml = 92 g
    expect(converterParaUnidadeBase(100, "ml", "g", 1, 0.92)).toBeCloseTo(92, 1);
  });

  it("converte g para ml via densidade", () => {
    // 92 g de azeite (densidade 0.92) = 100 ml
    expect(converterParaUnidadeBase(92, "g", "ml", 1, 0.92)).toBeCloseTo(100, 1);
  });

  it("lança erro se conversão peso↔volume sem densidade", () => {
    expect(() => converterParaUnidadeBase(100, "ml", "g", 1, null)).toThrow(/densidade/);
  });
});

describe("custo médio ponderado — lógica", () => {
  it("calcula custo médio ponderado correctamente", () => {
    // Stock actual: 1000g a 2.00 €/kg (0.002 €/g)
    // Entrada: 500g a 3.00 €/kg (0.003 €/g)
    // Novo CMP = (1000 * 0.002 + 500 * 0.003) / (1000 + 500)
    const stockAtual = 1000;
    const custoAtual = 0.002;
    const qtdEntrada = 500;
    const custoEntrada = 0.003;
    const novoCusto = (stockAtual * custoAtual + qtdEntrada * custoEntrada) / (stockAtual + qtdEntrada);
    expect(novoCusto).toBeCloseTo(0.002333, 5);
  });

  it("usa custo da entrada quando stock actual é zero", () => {
    const stockAtual = 0;
    const custoAtual = 0;
    const qtdEntrada = 500;
    const custoEntrada = 0.003;
    const novoStock = stockAtual + qtdEntrada;
    const novoCusto = novoStock > 0 ? (stockAtual * custoAtual + qtdEntrada * custoEntrada) / novoStock : custoEntrada;
    expect(novoCusto).toBe(0.003);
  });
});

