export function calcularEstadoContaPagar(estadoPagamento: "pendente" | "paga", dataVencimento?: Date | null, hoje = new Date()): "pendente" | "atrasado" | "paga" {
  if (estadoPagamento === "paga") return "paga";
  if (!dataVencimento) return "pendente";
  const dataLimite = dataVencimento.toISOString().slice(0, 10);
  const dataAtual = hoje.toISOString().slice(0, 10);
  return dataLimite < dataAtual ? "atrasado" : "pendente";
}
