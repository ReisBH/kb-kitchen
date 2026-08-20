import { describe, expect, it } from "vitest";
import { calcularCustoNos, type NoExplosao } from "./explosao";

const no = (custoTotal: number, filhos?: NoExplosao[]): NoExplosao => ({
  artigoId: 1,
  nome: "Componente",
  tipo: "ingrediente",
  quantidade: 1,
  unidade: "g",
  custoUnitario: custoTotal,
  custoTotal,
  nivel: 0,
  filhos,
});

describe("custo em cascata", () => {
  it("usa os ingredientes filhos de uma receita base sem somar o custo médio do pai em duplicado", () => {
    const receitaBase = no(9, [no(1.5), no(2.25)]);
    expect(calcularCustoNos([receitaBase])).toBeCloseTo(3.75, 6);
  });

  it("mantém o custo direto quando a receita base ainda não tem filhos calculáveis", () => {
    expect(calcularCustoNos([no(4.2, [])])).toBeCloseTo(4.2, 6);
  });
});
