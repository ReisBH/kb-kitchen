import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { describe, expect, it } from "vitest";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "import-audit-user",
      email: "audit@example.com",
      name: "Import Audit",
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

describe("fichas.listar após importação", () => {
  it("preserva as fichas importadas e inclui as fichas adicionadas do menu", async () => {
    const fichas = await appRouter.createCaller(createAuthenticatedContext()).fichas.listar();

    expect(fichas.length).toBeGreaterThanOrEqual(128);
    expect(fichas.some((ficha) => ficha.nome === "Tártaro Toro")).toBe(true);
    expect(fichas.some((ficha) => ficha.nome === "Tartaro Toro")).toBe(false);
    expect(fichas.some((ficha) => ficha.nome === "Menu Degustação Vegan")).toBe(true);
    expect(fichas.filter((ficha) => (ficha.custoCalculado ?? 0) > 0)).not.toHaveLength(0);
    expect(fichas.find((ficha) => ficha.nome === "1/4 Gyutataki")?.custoCalculado ?? 0).toBeGreaterThan(0);
  }, 20_000);

  it("filtra para vendas apenas fichas publicadas", async () => {
    const publicadas = await appRouter.createCaller(createAuthenticatedContext()).fichas.listar({ apenasPublicadas: true });
    expect(publicadas.length).toBeGreaterThan(0);
    expect(publicadas.every((ficha) => ficha.estadoPublicacao === "publicada" && ficha.ativo)).toBe(true);
  }, 20_000);
});
