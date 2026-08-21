import { describe, expect, it } from "vitest";
import { validarQuantidadeComercial } from "./regras_venda_fichas";

describe("validarQuantidadeComercial", () => {
  it("bloqueia um pedido por peso abaixo do mínimo", () => {
    expect(validarQuantidadeComercial(149, { unidadePrecoVenda: "g", quantidadeMinimaVenda: 150 })).toBe("O pedido mínimo é 150 g.");
  });

  it("aceita o mínimo e não impõe quantidade mínima a doses", () => {
    expect(validarQuantidadeComercial(150, { unidadePrecoVenda: "g", quantidadeMinimaVenda: 150 })).toBeNull();
    expect(validarQuantidadeComercial(1, { unidadePrecoVenda: "dose", quantidadeMinimaVenda: 150 })).toBeNull();
  });
});
