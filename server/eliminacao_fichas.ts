export type DependenciasFicha = {
  linhasVenda: number;
  mapeamentosPos: number;
};

export function mensagemBloqueioEliminacaoFicha(dependencias: DependenciasFicha): string | null {
  const motivos: string[] = [];
  if (dependencias.linhasVenda > 0) motivos.push(`${dependencias.linhasVenda} linha(s) de venda`);
  if (dependencias.mapeamentosPos > 0) motivos.push(`${dependencias.mapeamentosPos} mapeamento(s) POS`);
  if (!motivos.length) return null;
  return `Não é possível eliminar esta ficha porque está ligada a ${motivos.join(" e ")}. Preserve o histórico e desative-a apenas após remover as dependências operacionais.`;
}
