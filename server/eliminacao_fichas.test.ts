import { describe, expect, it } from "vitest";
import { mensagemBloqueioEliminacaoFicha } from "./eliminacao_fichas";

describe("mensagemBloqueioEliminacaoFicha", () => {
  it("permite a desativação quando não existem dependências operacionais", () => {
    expect(mensagemBloqueioEliminacaoFicha({ linhasVenda: 0, mapeamentosPos: 0 })).toBeNull();
  });

  it("bloqueia a eliminação quando a ficha tem vendas ou mapeamento POS", () => {
    const mensagem = mensagemBloqueioEliminacaoFicha({ linhasVenda: 2, mapeamentosPos: 1 });
    expect(mensagem).toContain("2 linha(s) de venda");
    expect(mensagem).toContain("1 mapeamento(s) POS");
  });
});
