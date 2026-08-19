import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "recipe-import-audit-user",
      email: "recipe-audit@example.com",
      name: "Recipe Import Audit",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("receitas base após importação", () => {
  it("devolve 104 receitas sem rendimento/custo provisório, prontas para preenchimento manual", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const receitas = await caller.receitas.listar();

    expect(receitas).toHaveLength(104);
    expect(receitas.every((receita) => receita.rendimentoEsperado === null)).toBe(true);
    expect(receitas.every((receita) => Number(receita.custoMedioPonderado ?? 0) === 0)).toBe(true);

    const shari = receitas.find((receita) => receita.nome === "Shari");
    expect(shari).toBeDefined();
    const custo = await caller.receitas.custo({ id: shari!.id, quantidade: 1 });
    expect(custo).toEqual({ nos: [], custoTotal: 0 });
  }, 20_000);
});
