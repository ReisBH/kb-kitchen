import { describe, expect, it } from "vitest";
import { imagemArmazenamentoSchema } from "./ocrInput";

describe("Referência de imagem OCR", () => {
  it("aceita a URL relativa devolvida pelo armazenamento interno", () => {
    expect(imagemArmazenamentoSchema.parse("/manus-storage/ocr/42/fatura.jpg")).toBe("/manus-storage/ocr/42/fatura.jpg");
  });

  it("rejeita referências externas que não pertencem ao armazenamento interno", () => {
    expect(imagemArmazenamentoSchema.safeParse("https://exemplo.test/fatura.jpg").success).toBe(false);
  });
});
