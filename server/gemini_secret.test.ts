import { describe, expect, it } from "vitest";

import { MODELO_GEMINI_FATURAS } from "./faturasGemini";

describe("Chave Gemini", () => {
  it("autentica e disponibiliza o modelo configurado para faturas sem expor a chave", async () => {
    const chave = process.env.GEMINI_API_KEY;
    expect(chave).toBeTruthy();

    const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(chave!)}`);
    expect(resposta.ok).toBe(true);

    const corpo = await resposta.json() as { models?: Array<{ name?: string }> };
    expect(corpo.models?.some((modelo) => modelo.name === `models/${MODELO_GEMINI_FATURAS}`)).toBe(true);
  }, 15_000);
});
