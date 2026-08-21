import { storageGetSignedUrl } from "./storage";

export const MODELO_GEMINI_FATURAS = "gemini-3.6-flash";
export const MODELO_GEMINI_FATURAS_ALTERNATIVO = "gemini-3.5-flash";
export const MODELOS_GEMINI_FATURAS = [MODELO_GEMINI_FATURAS, MODELO_GEMINI_FATURAS_ALTERNATIVO] as const;
const TENTATIVAS_POR_MODELO = 2;

export type LinhaFaturaGemini = {
  descricao: string;
  quantidade: number;
  unidade: string;
  pesoOuUnidade: string;
  precoPorUnidade: number;
  taxaIva: number;
  valorIva: number;
  valorLinha: number;
  confianca: "alta" | "media" | "baixa";
};

export type FaturaGemini = {
  fornecedor: string;
  nif: string;
  numero: string;
  dataEmissao?: string;
  dataVencimento?: string;
  dataVencimentoCalculada: boolean;
  condicoesPagamento: string;
  valorTotal: number;
  linhas: LinhaFaturaGemini[];
};

const GEMINI_FATURA_SCHEMA = {
  type: "object",
  properties: {
    fornecedor: { type: "string" },
    nif: { type: "string" },
    numero: { type: "string" },
    dataEmissao: { type: "string", description: "Data no formato YYYY-MM-DD" },
    dataVencimento: { type: "string", description: "Data no formato YYYY-MM-DD" },
    dataVencimentoCalculada: { type: "boolean" },
    condicoesPagamento: { type: "string" },
    valorTotal: { type: "number" },
    linhas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          quantidade: { type: "number" },
          unidade: { type: "string" },
          pesoOuUnidade: { type: "string" },
          precoPorUnidade: { type: "number" },
          taxaIva: { type: "number" },
          valorIva: { type: "number" },
          valorLinha: { type: "number" },
          confianca: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["descricao", "quantidade", "unidade", "precoPorUnidade", "taxaIva", "valorLinha"],
      },
    },
  },
  required: ["fornecedor", "valorTotal", "linhas"],
} as const;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

export function numeroFatura(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const original = texto(valor);
  if (!original) return 0;
  const semSimbolos = original.replace(/[^\d,.-]/g, "");
  const normalizado = semSimbolos.includes(",") && semSimbolos.includes(".")
    ? semSimbolos.replace(/\./g, "").replace(",", ".")
    : semSimbolos.replace(",", ".");
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : 0;
}

export function normalizarDataFatura(valor: unknown): string | undefined {
  const data = texto(valor);
  if (!data) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const portuguesa = data.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!portuguesa) return undefined;
  const [, dia, mes, ano] = portuguesa;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export function calcularDataVencimento(dataEmissao: string | undefined, condicoesPagamento: string): string | undefined {
  if (!dataEmissao) return undefined;
  const dias = condicoesPagamento.match(/(\d{1,3})\s*dias?/i)?.[1];
  if (!dias) return undefined;
  const [ano, mes, dia] = dataEmissao.split("-").map(Number);
  const calculada = new Date(Date.UTC(ano, mes - 1, dia + Number(dias)));
  return calculada.toISOString().slice(0, 10);
}

export function normalizarFaturaGemini(bruta: any): FaturaGemini {
  const dataEmissao = normalizarDataFatura(bruta?.dataEmissao ?? bruta?.data_emissao);
  const vencimentoLido = normalizarDataFatura(bruta?.dataVencimento ?? bruta?.data_vencimento);
  const condicoesPagamento = texto(bruta?.condicoesPagamento ?? bruta?.condicoes_pagamento);
  const dataVencimento = vencimentoLido ?? calcularDataVencimento(dataEmissao, condicoesPagamento);
  const linhas = Array.isArray(bruta?.linhas) ? bruta.linhas.map((linha: any): LinhaFaturaGemini => {
    const quantidade = numeroFatura(linha?.quantidade);
    const precoPorUnidade = numeroFatura(linha?.precoPorUnidade ?? linha?.preco_por_unidade ?? linha?.precoUnitario ?? linha?.preco_unitario);
    const valorLinha = numeroFatura(linha?.valorLinha ?? linha?.valor_linha ?? linha?.precoTotal ?? linha?.preco_total) || quantidade * precoPorUnidade;
    const confianca = ["alta", "media", "baixa"].includes(texto(linha?.confianca)) ? texto(linha?.confianca) as LinhaFaturaGemini["confianca"] : "media";
    return {
      descricao: texto(linha?.descricao),
      quantidade,
      unidade: texto(linha?.unidade) || "un",
      pesoOuUnidade: texto(linha?.pesoOuUnidade ?? linha?.peso_ou_unidade ?? linha?.unidade),
      precoPorUnidade,
      taxaIva: numeroFatura(linha?.taxaIva ?? linha?.taxa_iva),
      valorIva: numeroFatura(linha?.valorIva ?? linha?.valor_iva),
      valorLinha,
      confianca,
    };
  }) : [];

  return {
    fornecedor: texto(bruta?.fornecedor),
    nif: texto(bruta?.nif ?? bruta?.nif_fornecedor),
    numero: texto(bruta?.numero ?? bruta?.numeroFatura ?? bruta?.numero_fatura),
    dataEmissao,
    dataVencimento,
    dataVencimentoCalculada: !vencimentoLido && Boolean(dataVencimento),
    condicoesPagamento,
    valorTotal: numeroFatura(bruta?.valorTotal ?? bruta?.valor_total),
    linhas,
  };
}

function mimeTypePorChave(chave: string): string {
  const ext = chave.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}

export function chaveArmazenadaDaUrl(imagemUrl?: string): string | undefined {
  if (!imagemUrl?.startsWith("/manus-storage/")) return undefined;
  const chave = imagemUrl.slice("/manus-storage/".length).split(/[?#]/)[0];
  if (!chave || chave.includes("..")) return undefined;
  return chave;
}

export function erroGeminiTransitorio(status: number) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

export function atrasoTentativaGemini(tentativa: number, retryAfter?: string | null) {
  const segundosIndicados = Number(retryAfter);
  if (Number.isFinite(segundosIndicados) && segundosIndicados > 0) return Math.min(segundosIndicados * 1000, 5_000);
  return Math.min(750 * (tentativa + 1), 2_000);
}

async function aguardar(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pedirGeminiComContingencia(
  chaveApi: string,
  pedido: unknown,
  fetcher: typeof fetch = fetch,
  esperar: (ms: number) => Promise<void> = aguardar,
) {
  let ultimoStatus: number | undefined;
  for (const modelo of MODELOS_GEMINI_FATURAS) {
    for (let tentativa = 0; tentativa < TENTATIVAS_POR_MODELO; tentativa++) {
      const resposta = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chaveApi },
        body: JSON.stringify(pedido),
      });
      if (resposta.ok) return { resposta, modelo };
      ultimoStatus = resposta.status;
      if (!erroGeminiTransitorio(resposta.status)) break;
      if (tentativa < TENTATIVAS_POR_MODELO - 1) await esperar(atrasoTentativaGemini(tentativa, resposta.headers.get("retry-after")));
    }
  }
  if (ultimoStatus && erroGeminiTransitorio(ultimoStatus)) throw new Error("A Gemini está temporariamente indisponível. Foram feitas tentativas automáticas nos modelos disponíveis; tenta novamente dentro de instantes.");
  throw new Error(`A Gemini não conseguiu ler a fatura (${ultimoStatus ?? "sem resposta"}).`);
}

export async function extrairFaturaComGemini(imagemKey: string, imagemUrl?: string): Promise<FaturaGemini> {
  const chaveApi = process.env.GEMINI_API_KEY;
  if (!chaveApi) throw new Error("A chave Gemini não está configurada.");

  const chaveEfetiva = chaveArmazenadaDaUrl(imagemUrl) ?? imagemKey;
  const urlAssinada = await storageGetSignedUrl(chaveEfetiva);
  const ficheiro = await fetch(urlAssinada);
  if (!ficheiro.ok) throw new Error("Não foi possível obter a imagem da fatura para análise.");
  const bytes = Buffer.from(await ficheiro.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) throw new Error("A imagem da fatura deve ter entre 1 byte e 20 MB.");
  const mimeType = ficheiro.headers.get("content-type")?.split(";")[0] || mimeTypePorChave(chaveEfetiva);

  const pedido = {
    contents: [{
      parts: [
        { text: "Lê esta fatura de fornecedor de restauração em Portugal. Extrai exclusivamente os dados factualmente visíveis. Identifica fornecedor, NIF, número, data de emissão, data de vencimento, condições de pagamento e valor total com IVA. Para cada produto, extrai descrição, peso ou unidade, quantidade, preço por kg/unidade, taxa de IVA, valor de IVA e valor da linha. Datas usam YYYY-MM-DD. Se a data de vencimento não estiver impressa e existir condição em dias, calcula-a a partir da emissão e assinala dataVencimentoCalculada. Nunca inventes dados: usa vazio ou 0 quando não for possível ler." },
        { inlineData: { mimeType, data: bytes.toString("base64") } },
      ],
    }],
    generationConfig: { responseMimeType: "application/json", responseSchema: GEMINI_FATURA_SCHEMA, temperature: 0 },
  };
  const { resposta } = await pedirGeminiComContingencia(chaveApi, pedido);
  const corpo = await resposta.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const textoResposta = corpo.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textoResposta) throw new Error("A Gemini devolveu uma resposta vazia.");
  try {
    return normalizarFaturaGemini(JSON.parse(textoResposta));
  } catch {
    throw new Error("A resposta da Gemini não continha dados estruturados válidos.");
  }
}
