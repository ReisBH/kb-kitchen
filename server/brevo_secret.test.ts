import { describe, expect, it } from "vitest";

describe("configuração Brevo", () => {
  it("aceita a chave API configurada", async () => {
    const chave = process.env.BREVO_API_KEY;
    expect(chave).toBeTruthy();
    const resposta = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": chave! },
      signal: AbortSignal.timeout(10_000),
    });
    expect(resposta.status).toBe(200);
  }, 15_000);
});
