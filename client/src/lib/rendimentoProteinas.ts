export const IDS_PROTEINAS_RENDIMENTO_SOLICITADAS = [
  15, 72, 104, 238, 239, 250, 253, 255, 272, 274, 275, 276, 298, 299, 300, 301, 308, 310,
] as const;

type ArtigoRendimento = {
  id: number;
  requerLimpeza: boolean;
  artigoBrutoId?: number | null;
};

/** Devolve os artigos que foram marcados explicitamente para teste de rendimento. */
export function filtrarProteinasParaRendimento<T extends ArtigoRendimento>(artigos: readonly T[]): T[] {
  return artigos.filter((artigo) => artigo.requerLimpeza === true);
}

/** Devolve apenas os destinos limpos que pertencem ao artigo bruto selecionado. */
export function filtrarArtigosLimposDoBruto<T extends ArtigoRendimento>(
  artigosLimpos: readonly T[],
  artigoBrutoId?: number,
): T[] {
  if (!artigoBrutoId) return [];
  return artigosLimpos.filter((artigo) => artigo.artigoBrutoId === artigoBrutoId);
}
