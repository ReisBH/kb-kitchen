/**
 * Format a quantity according to its unit:
 * - g  → 1 decimal place  (e.g. 2.5g, 150.0g)
 * - ml → integer          (e.g. 200ml, 15ml)
 * - un → integer          (e.g. 2un)
 * - anything else → 1 decimal
 */
export function fmtQtd(quantidade: number | string | null | undefined, unidade: string): string {
  if (quantidade == null) return "—";
  const n = parseFloat(String(quantidade));
  if (isNaN(n)) return "—";

  const u = (unidade ?? "").toLowerCase().trim();

  if (u === "ml") {
    return `${Math.round(n)} ml`;
  }
  if (u === "un") {
    return `${Math.round(n)} un`;
  }
  // g and everything else: 1 decimal
  return `${n.toFixed(1)} ${unidade}`;
}

