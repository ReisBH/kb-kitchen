import { describe, expect, it } from "vitest";

describe("credenciais Resend", () => {
  it("autentica a chave configurada ao consultar os domínios verificados", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeTruthy();
    const resposta = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(resposta.status).toBe(200);
  }, 15_000);
});
