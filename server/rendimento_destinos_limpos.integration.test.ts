import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { describe, expect, it } from "vitest";
import { filtrarArtigosLimposDoBruto } from "../client/src/lib/rendimentoProteinas";

const IDS_BRUTOS_RENDIMENTO = [15, 72, 104, 238, 239, 250, 253, 255, 272, 274, 275, 276, 298, 299, 300, 301, 308, 310];

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "rendimento-destino-audit",
      email: "audit@example.com",
      name: "Rendimento Audit",
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

describe("destinos limpos de rendimentos", () => {
  it("mantém um destino proteina_limpa ativo para cada proteína bruta configurada", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const destinos = await caller.artigos.listar({ tipo: "proteina_limpa" });
    const destinosDosBrutos = destinos.filter((destino) => IDS_BRUTOS_RENDIMENTO.includes(destino.artigoBrutoId ?? -1));

    expect(destinosDosBrutos).toHaveLength(18);
    expect(new Set(destinosDosBrutos.map((destino) => destino.artigoBrutoId)).size).toBe(18);
    expect(destinosDosBrutos.every((destino) => destino.ativo && destino.unidadeBase === "g")).toBe(true);
  }, 20_000);

  it("oferece exatamente o destino associado para cada uma das 18 proteínas na lógica do seletor", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const destinos = await caller.artigos.listar({ tipo: "proteina_limpa" });

    for (const brutoId of IDS_BRUTOS_RENDIMENTO) {
      const opcoesDoSeletor = filtrarArtigosLimposDoBruto(destinos, brutoId);
      expect(opcoesDoSeletor).toHaveLength(1);
      expect(opcoesDoSeletor[0]?.artigoBrutoId).toBe(brutoId);
    }
  }, 20_000);
});
