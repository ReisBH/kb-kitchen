import { describe, it, expect } from "vitest";

// Teste da lógica de deteção de ciclos (versão simplificada sem DB)
function detetarCicloSimples(
  receitaId: number,
  componenteId: number,
  grafo: Map<number, number[]>
): boolean {
  if (componenteId === receitaId) return true;
  const filhos = grafo.get(componenteId) ?? [];
  for (const filho of filhos) {
    if (detetarCicloSimples(receitaId, filho, grafo)) return true;
  }
  return false;
}

describe("motor de explosão — deteção de ciclos", () => {
  it("não deteta ciclo em receita sem dependências circulares", () => {
    // Receita A usa ingrediente B (sem ciclo)
    const grafo = new Map([[1, [2, 3]], [2, []], [3, []]]);
    expect(detetarCicloSimples(1, 2, grafo)).toBe(false);
  });

  it("deteta ciclo directo (A usa A)", () => {
    const grafo = new Map([[1, [1]]]);
    expect(detetarCicloSimples(1, 1, grafo)).toBe(true);
  });

  it("deteta ciclo indirecto (A → B → C → A)", () => {
    const grafo = new Map([[1, [2]], [2, [3]], [3, [1]]]);
    expect(detetarCicloSimples(1, 2, grafo)).toBe(true);
  });

  it("não deteta ciclo em cadeia linear (A → B → C)", () => {
    const grafo = new Map([[1, [2]], [2, [3]], [3, []]]);
    expect(detetarCicloSimples(1, 2, grafo)).toBe(false);
  });

  it("deteta ciclo a 3 níveis de profundidade", () => {
    // A usa B, B usa C, C usa D, D usa A
    const grafo = new Map([[1, [2]], [2, [3]], [3, [4]], [4, [1]]]);
    expect(detetarCicloSimples(1, 2, grafo)).toBe(true);
  });
});

