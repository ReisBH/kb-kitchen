import { describe, expect, it } from "vitest";
import { podeDecidirAprovacao } from "./routers/receitas";

describe("aprovação em dois níveis de produção", () => {
  it("impede que o solicitante aprove a própria produção", () => {
    expect(podeDecidirAprovacao(12, 12)).toBe(false);
  });

  it("aceita a decisão de outro utilizador autorizado", () => {
    expect(podeDecidirAprovacao(12, 21)).toBe(true);
  });
});
