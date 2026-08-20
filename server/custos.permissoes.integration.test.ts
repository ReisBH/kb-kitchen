import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contexto(role: "admin" | "cozinheiro"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `custo-${role}`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("permissões de custos detalhados", () => {
  it("omite custos de componentes para o perfil cozinheiro", async () => {
    const caller = appRouter.createCaller(contexto("cozinheiro"));
    const receita = await caller.receitas.obter({ id: 60070 });
    const ficha = await caller.fichas.obter({ id: 30001 });

    expect(receita?.componentes.every((item) => item.custoComponente === null)).toBe(true);
    expect(ficha?.componentes.every((item) => item.custoComponente === null)).toBe(true);
    expect(ficha?.custoCalculado).toBeNull();
    expect(ficha?.arvore.every((item) => item.custoTotal === 0 && item.custoUnitario === 0)).toBe(true);
  });

  it("mantém custos detalhados disponíveis para o administrador", async () => {
    const caller = appRouter.createCaller(contexto("admin"));
    const receita = await caller.receitas.obter({ id: 60070 });
    const ficha = await caller.fichas.obter({ id: 30001 });

    expect(receita?.componentes.some((item) => Number(item.custoComponente ?? 0) > 0)).toBe(true);
    expect(Number(ficha?.custoCalculado ?? 0)).toBeGreaterThan(0);
  });

  it("calcula o custo equivalente quando a receita referencia gramas de um artigo nativo por unidade", async () => {
    const caller = appRouter.createCaller(contexto("admin"));
    const receita = await caller.receitas.obter({ id: 60087 });
    const shisoRoxo = receita?.componentes.find((item) => item.nomeComponente === "Vaso Shiso roxo");

    expect(shisoRoxo?.unidade).toBe("g");
    expect(Number(shisoRoxo?.quantidade)).toBeCloseTo(0.8, 4);
    expect(Number(shisoRoxo?.custoTotal)).toBeCloseTo(0.616, 4);
  });
});
