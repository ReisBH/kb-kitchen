import { describe, expect, it } from "vitest";
import { prepararNovoArtigo } from "../client/src/lib/novoArtigo";

describe("prepararNovoArtigo", () => {
  it("converte fornecedor selecionado em número e preserva a categoria existente", () => {
    const resultado = prepararNovoArtigo({ fornecedorId: "42", categoria: "Peixaria", fatorConversao: "1", stockMinimo: "1000", stockMaximo: "2000" });

    expect(resultado.fornecedorId).toBe(42);
    expect(resultado.categoria).toBe("Peixaria");
    expect(resultado.stockMinimo).toBe(1000);
    expect(resultado.stockMaximo).toBe(2000);
  });

  it("converte o fornecedor vazio em indefinido para a validação opcional do servidor", () => {
    const resultado = prepararNovoArtigo({ fornecedorId: "", categoria: "  Nova categoria  ", fatorConversao: "1", stockMinimo: "0" });

    expect(resultado.fornecedorId).toBeUndefined();
    expect(resultado.categoria).toBe("Nova categoria");
    expect(resultado.stockMaximo).toBeUndefined();
  });
});
