import { describe, expect, it } from "vitest";

describe("Chave Gemini", () => {
  it("autentica na lista de modelos sem expor a chave", async () => {
    const chave = process.env.GEMINI_API_KEY;
    expect(chave).toBeTruthy();

    const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(chave!)}`);
    expect(resposta.ok).toBe(true);

    const corpo = await resposta.json() as { models?: unknown[] };
    expect(Array.isArray(corpo.models)).toBe(true);
  }, 15_000);
});
