export type DadosFormularioNovoArtigo = Record<string, unknown>;

export function prepararNovoArtigo(dados: DadosFormularioNovoArtigo) {
  const fornecedorBruto = String(dados.fornecedorId ?? "").trim();
  const fornecedorId = fornecedorBruto ? Number(fornecedorBruto) : undefined;
  const categoria = String(dados.categoria ?? "").trim();
  const stockMaximoBruto = String(dados.stockMaximo ?? "").trim();
  const stockMaximo = stockMaximoBruto === "" ? undefined : Number(stockMaximoBruto);

  return {
    ...dados,
    categoria: categoria || undefined,
    fornecedorId: typeof fornecedorId === "number" && Number.isInteger(fornecedorId) && fornecedorId > 0 ? fornecedorId : undefined,
    fatorConversao: Number(dados.fatorConversao ?? 1),
    stockMinimo: Number(dados.stockMinimo ?? 0),
    stockMaximo,
  };
}
