import { describe, expect, it } from "vitest";
import { requerAprovacaoInventario } from "./routers/inventario";

describe("aprovação de inventário crítico", () => {
  it("envia para aprovação quando o desvio é superior a 5% e material", () => {
    expect(requerAprovacaoInventario([{ desvioPct: "5.001", desvioQtd: "0.010" }])).toBe(true);
  });

  it("não bloqueia ajustes abaixo do limiar ou sem diferença física material", () => {
    expect(requerAprovacaoInventario([{ desvioPct: "5.000", desvioQtd: "50.000" }])).toBe(false);
    expect(requerAprovacaoInventario([{ desvioPct: "80.000", desvioQtd: "0.000" }])).toBe(false);
  });
});
