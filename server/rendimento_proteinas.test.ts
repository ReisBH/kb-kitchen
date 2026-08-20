import { describe, expect, it } from "vitest";
import {
  IDS_PROTEINAS_RENDIMENTO_SOLICITADAS,
  filtrarArtigosLimposDoBruto,
  filtrarProteinasParaRendimento,
} from "../client/src/lib/rendimentoProteinas";

describe("elegibilidade de proteínas para rendimentos", () => {
  it("mantém os 18 ingredientes indicados pelo utilizador na lista de controlo", () => {
    expect(IDS_PROTEINAS_RENDIMENTO_SOLICITADAS).toHaveLength(18);
    expect(IDS_PROTEINAS_RENDIMENTO_SOLICITADAS).toEqual(expect.arrayContaining([15, 104, 238, 310]));
  });

  it("mostra apenas artigos marcados como requerendo limpeza", () => {
    const artigos = [
      { id: 238, requerLimpeza: true },
      { id: 236, requerLimpeza: false },
      { id: 310, requerLimpeza: true },
    ];

    expect(filtrarProteinasParaRendimento(artigos).map((artigo) => artigo.id)).toEqual([238, 310]);
  });

  it("não oferece um artigo limpo pertencente a outra proteína", () => {
    const artigosLimpos = [
      { id: 9001, requerLimpeza: false, artigoBrutoId: 238 },
      { id: 9002, requerLimpeza: false, artigoBrutoId: 239 },
    ];

    expect(filtrarArtigosLimposDoBruto(artigosLimpos, 238).map((artigo) => artigo.id)).toEqual([9001]);
    expect(filtrarArtigosLimposDoBruto(artigosLimpos, 310)).toEqual([]);
  });
});
