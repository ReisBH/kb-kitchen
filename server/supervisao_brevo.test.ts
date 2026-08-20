import { describe, expect, it } from "vitest";
import { construirPedidoEmailBrevo } from "./services/supervisao";

describe("pedido de e-mail Brevo", () => {
  it("usa o remetente ativo e preserva os dois destinatários de chefia", () => {
    const pedido = construirPedidoEmailBrevo(["rafaelreiss@gmail.com", "diegogarcapd@gmail.com"], "Alerta", "<p>Teste</p>");
    expect(pedido.sender).toEqual({ name: "CozinhaKabuki", email: "cozinhakabuki@gmail.com" });
    expect(pedido.to).toEqual([{ email: "rafaelreiss@gmail.com" }, { email: "diegogarcapd@gmail.com" }]);
    expect(pedido.subject).toBe("Alerta");
  });
});
