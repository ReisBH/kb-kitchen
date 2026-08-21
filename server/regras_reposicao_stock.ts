function numeroSeguro(valor: unknown): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function fatorConversaoEfetivo(regra: Pick<RegraReposicao, "fatorConversao" | "unidadeBase" | "unidadeCompra">): number {
  const fatorConfigurado = Math.max(0, numeroSeguro(regra.fatorConversao));
  const compra = regra.unidadeCompra?.trim().toLowerCase();
  const base = regra.unidadeBase.trim().toLowerCase();

  // Dados históricos podem ter kg/l com fator 1; a conversão universal só é
  // inferida quando não existe um fator personalizado acima de 1.
  if (fatorConfigurado <= 1 && compra === "kg" && base === "g") return 1000;
  if (fatorConfigurado <= 1 && (compra === "l" || compra === "lt") && base === "ml") return 1000;
  return fatorConfigurado > 0 ? fatorConfigurado : 1;
}

export type RegraReposicao = {
  stockAtual: number;
  stockMinimo: number | string | null | undefined;
  stockMaximo: number | string | null | undefined;
  fatorConversao: number | string | null | undefined;
  unidadeBase: string;
  unidadeCompra?: string | null;
};

export function calcularReposicaoAteMaximo(regra: RegraReposicao) {
  const minimo = Math.max(0, numeroSeguro(regra.stockMinimo));
  const maximo = Math.max(0, numeroSeguro(regra.stockMaximo));
  const stockAtual = numeroSeguro(regra.stockAtual);

  if (stockAtual >= minimo) return null;

  // Sem máximo (ou máximo incoerente), a regra segura é repor apenas até ao mínimo.
  const alvoEmBase = maximo > minimo ? maximo : minimo;
  const quantidadeEmBase = Math.max(0, alvoEmBase - stockAtual);
  const temUnidadeCompra = Boolean(regra.unidadeCompra?.trim());
  const divisor = temUnidadeCompra ? fatorConversaoEfetivo(regra) : 1;
  const quantidadeEncomenda = Math.ceil((quantidadeEmBase / divisor) * 1000) / 1000;

  return {
    alvoEmBase,
    quantidadeEmBase,
    quantidadeEncomenda,
    unidadeEncomenda: temUnidadeCompra ? regra.unidadeCompra!.trim() : regra.unidadeBase,
    usaStockMaximo: maximo > minimo,
    fatorPrecoEstimado: divisor,
  };
}
