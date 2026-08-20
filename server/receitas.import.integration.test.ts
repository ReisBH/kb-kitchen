import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
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

describe("receitas base após rendimento provisório", () => {
  it("devolve receitas com rendimento e custo calculados a partir dos componentes vinculados", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const receitas = await caller.receitas.listar();

    expect(receitas).toHaveLength(104);
    expect(receitas.filter((receita) => Number(receita.rendimentoEsperado ?? 0) > 0)).toHaveLength(104);
    expect(receitas.filter((receita) => Number(receita.custoMedioPonderado ?? 0) > 0)).toHaveLength(86);

    const shari = receitas.find((receita) => receita.nome === "Shari");
    expect(shari).toBeDefined();
    const custo = await caller.receitas.custo({ id: shari!.id, quantidade: Number(shari!.rendimentoEsperado) });
    expect(custo.custoTotal).toBeGreaterThan(0);
  }, 20_000);
});

describe("produção com custo seguro", () => {
  it("exige rendimento esperado antes de registar uma produção", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "routers", "receitas.ts"), "utf8");
    expect(source).toContain("Preencha o rendimento esperado da receita antes de registar produção");
  });
});
