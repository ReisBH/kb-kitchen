import { describe, expect, it } from "vitest";
import { calcularDataVencimento, chaveArmazenadaDaUrl, erroGeminiTransitorio, MODELO_GEMINI_FATURAS_ALTERNATIVO, normalizarFaturaGemini, numeroFatura, pedirGeminiComContingencia } from "./faturasGemini";

describe("Normalização de fatura Gemini", () => {
  it("normaliza valores portugueses, IVA por linha e vencimento calculado", () => {
    const fatura = normalizarFaturaGemini({
      fornecedor: "Makro",
      dataEmissao: "10/08/2026",
      condicoesPagamento: "30 dias",
      valorTotal: "1.234,50 €",
      linhas: [{ descricao: "Arroz", quantidade: "5", unidade: "kg", precoPorUnidade: "12,30", taxaIva: "6", valorIva: "3,69", valorLinha: "61,50", confianca: "alta" }],
    });

    expect(numeroFatura("1.234,50 €")).toBe(1234.5);
    expect(calcularDataVencimento("2026-08-10", "30 dias")).toBe("2026-09-09");
    expect(fatura.dataVencimento).toBe("2026-09-09");
    expect(fatura.dataVencimentoCalculada).toBe(true);
    expect(fatura.linhas[0]).toMatchObject({ precoPorUnidade: 12.3, taxaIva: 6, valorLinha: 61.5 });
  });

  it("usa a chave física devolvida pelo armazenamento quando a URL recebe sufixo único", () => {
    expect(chaveArmazenadaDaUrl("/manus-storage/ocr/1/fatura_abc123.jpeg")).toBe("ocr/1/fatura_abc123.jpeg");
    expect(chaveArmazenadaDaUrl("/manus-storage/ocr/1/fatura_abc123.jpeg?versao=1")).toBe("ocr/1/fatura_abc123.jpeg");
    expect(chaveArmazenadaDaUrl("https://externo.exemplo/fatura.jpeg")).toBeUndefined();
  });

  it("repete uma indisponibilidade temporária e usa o modelo alternativo", async () => {
    const urls: string[] = [];
    const esperar: number[] = [];
    const fetcher = async (url: string | URL | Request) => {
      urls.push(String(url));
      if (urls.length < 3) return new Response("indisponível", { status: 503 });
      return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    };

    const resultado = await pedirGeminiComContingencia("chave-de-teste", { contents: [] }, fetcher as typeof fetch, async (ms) => { esperar.push(ms); });
    expect(resultado.resposta.ok).toBe(true);
    expect(urls).toHaveLength(3);
    expect(urls[2]).toContain(MODELO_GEMINI_FATURAS_ALTERNATIVO);
    expect(esperar).toHaveLength(1);
    expect(erroGeminiTransitorio(503)).toBe(true);
    expect(erroGeminiTransitorio(400)).toBe(false);
  });
});
