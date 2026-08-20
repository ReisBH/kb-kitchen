export type EntradaRendimento = {
  pesoBrutoGramas: number;
  pesoLimpoGramas: number;
  precoKgBruto: number;
  valorAparas?: number;
};

export function criarChavesIdempotenciaRendimento(idCliente: string) {
  if (idCliente.trim().length < 8 || idCliente.length > 56) {
    throw new Error("A chave de operação de rendimento é inválida.");
  }
  return {
    teste: idCliente,
    saida: `${idCliente}:saida`,
    entrada: `${idCliente}:entrada`,
  };
}

export function calcularCustoRendimento(input: EntradaRendimento) {
  const valorAparas = input.valorAparas ?? 0;
  if (input.pesoBrutoGramas <= 0 || input.pesoLimpoGramas <= 0) {
    throw new Error("Os pesos bruto e limpo devem ser superiores a zero.");
  }
  if (input.pesoLimpoGramas > input.pesoBrutoGramas) {
    throw new Error("O peso limpo não pode ser superior ao peso bruto.");
  }

  const custoTotalCompra = (input.pesoBrutoGramas / 1000) * input.precoKgBruto;
  const custoLiquido = custoTotalCompra - valorAparas;
  if (custoLiquido < 0) {
    throw new Error("O valor das aparas não pode exceder o custo da compra.");
  }

  const aproveitamentoPct = (input.pesoLimpoGramas / input.pesoBrutoGramas) * 100;
  const perdaPct = 100 - aproveitamentoPct;
  const custoRealPorKg = (custoLiquido / input.pesoLimpoGramas) * 1000;
  const custoPorGrama = custoRealPorKg / 1000;
  const sobrecusto = custoRealPorKg - input.precoKgBruto;

  return {
    custoTotalCompra,
    custoLiquido,
    aproveitamentoPct,
    perdaPct,
    custoRealPorKg,
    custoPorGrama,
    sobrecusto,
  };
}
