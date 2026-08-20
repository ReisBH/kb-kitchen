import { correspondePesquisaAproximada } from "@/lib/pesquisaAproximada";

export type OpcaoPesquisaComponente = {
  id: number;
  nome: string;
  unidadeBase: string;
  tipo: "ingrediente" | "proteina_limpa" | "receita_base" | "ficha_tecnica";
};

export function filtrarOpcoesComponentes(opcoes: OpcaoPesquisaComponente[], termo: string, limite = 12) {
  return opcoes
    .filter((opcao) => !termo.trim() || correspondePesquisaAproximada(opcao.nome, termo))
    .slice(0, limite);
}
