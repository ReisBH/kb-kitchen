import { describe, expect, it } from "vitest";
import { calcularReposicaoAteMaximo } from "./regras_reposicao_stock";

describe("calcularReposicaoAteMaximo", () => {
  it("recomenda a quantidade necessária para repor até ao stock máximo", () => {
    const resultado = calcularReposicaoAteMaximo({
      stockAtual: 40,
      stockMinimo: "50",
      stockMaximo: "100",
      fatorConversao: "25",
      unidadeBase: "g",
      unidadeCompra: "embalagem",
    });

    expect(resultado).toMatchObject({ alvoEmBase: 100, quantidadeEmBase: 60, quantidadeEncomenda: 2.4, unidadeEncomenda: "embalagem", usaStockMaximo: true });
  });

  it("restringe a reposição ao mínimo quando não existe stock máximo configurado", () => {
    const resultado = calcularReposicaoAteMaximo({ stockAtual: 8, stockMinimo: "20", stockMaximo: null, fatorConversao: "1", unidadeBase: "g" });

    expect(resultado).toMatchObject({ alvoEmBase: 20, quantidadeEmBase: 12, quantidadeEncomenda: 12, unidadeEncomenda: "g", usaStockMaximo: false });
  });

  it("interpreta kg como 1 000 g quando dados históricos ainda indicam fator 1", () => {
    const resultado = calcularReposicaoAteMaximo({ stockAtual: 0, stockMinimo: "1000", stockMaximo: null, fatorConversao: "1", unidadeBase: "g", unidadeCompra: "kg" });

    expect(resultado).toMatchObject({ quantidadeEmBase: 1000, quantidadeEncomenda: 1, unidadeEncomenda: "kg", fatorPrecoEstimado: 1000 });
  });

  it("não sugere encomenda quando o artigo não está abaixo do mínimo", () => {
    expect(calcularReposicaoAteMaximo({ stockAtual: 50, stockMinimo: "50", stockMaximo: "100", fatorConversao: "1", unidadeBase: "g" })).toBeNull();
  });
});
