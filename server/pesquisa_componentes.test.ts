import { describe, expect, it } from "vitest";
import { filtrarOpcoesComponentes } from "../client/src/lib/pesquisaComponentes";

const opcoes = [
  { id: 1, nome: "Abacate", unidadeBase: "g", tipo: "ingrediente" as const },
  { id: 2, nome: "Molho Tare", unidadeBase: "g", tipo: "receita_base" as const },
  { id: 3, nome: "Kabuki Sushi", unidadeBase: "ficha", tipo: "ficha_tecnica" as const },
];

describe("pesquisa de componentes", () => {
  it("encontra ingredientes, receitas base e fichas técnicas pelo nome", () => {
    expect(filtrarOpcoesComponentes(opcoes, "abaca")[0]).toMatchObject({ id: 1, tipo: "ingrediente" });
    expect(filtrarOpcoesComponentes(opcoes, "tare")[0]).toMatchObject({ id: 2, tipo: "receita_base" });
    expect(filtrarOpcoesComponentes(opcoes, "kabuki")[0]).toMatchObject({ id: 3, tipo: "ficha_tecnica" });
  });
});

