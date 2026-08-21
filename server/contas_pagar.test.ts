import { describe, expect, it } from "vitest";
import { calcularEstadoContaPagar } from "./contasPagar";

describe("Estado de contas a pagar", () => {
  const hoje = new Date("2026-08-21T12:00:00Z");

  it("calcula pendente, atrasado e paga a partir do vencimento", () => {
    expect(calcularEstadoContaPagar("pendente", new Date("2026-08-22T00:00:00Z"), hoje)).toBe("pendente");
    expect(calcularEstadoContaPagar("pendente", new Date("2026-08-20T00:00:00Z"), hoje)).toBe("atrasado");
    expect(calcularEstadoContaPagar("paga", new Date("2026-08-20T00:00:00Z"), hoje)).toBe("paga");
  });
});
