export type RegraPrecoFicha = {
  unidadePrecoVenda: "dose" | "un" | "pessoa" | "g";
  quantidadeMinimaVenda?: number | string | null;
};

export function validarQuantidadeComercial(quantidade: number, regra: RegraPrecoFicha): string | null {
  if (regra.unidadePrecoVenda !== "g") return null;
  const minimo = Number(regra.quantidadeMinimaVenda ?? 0);
  if (minimo > 0 && quantidade < minimo) {
    return `O pedido mínimo é ${minimo.toLocaleString("pt-PT")} g.`;
  }
  return null;
}
