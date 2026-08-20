export type DadosEtiquetaLote = {
  codigoLote: string;
  nomeProduto: string;
  quantidadeProduzida: number | string;
  unidade: string;
  dataProducao: Date | string;
  dataValidade?: Date | string | null;
  metodoConservacao?: string | null;
};

const escapeHtml = (valor: unknown) => String(valor ?? "").replace(/[&<>'"]/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[caracter]!);
const dataPt = (valor: Date | string | null | undefined) => valor ? new Date(valor).toLocaleDateString("pt-PT") : "N/D";

export function imprimirEtiquetaLote(lote: DadosEtiquetaLote) {
  const url = `${window.location.origin}/l/${encodeURIComponent(lote.codigoLote)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiqueta de Produção — ${escapeHtml(lote.nomeProduto)}</title><style>@page { size: 62mm 50mm; margin: 2mm; } body { margin: 0; font-family: Arial, sans-serif; font-size: 8pt; } .label { width: 58mm; padding: 2mm; } .nome { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 2mm; } .row { display:flex; justify-content:space-between; margin-bottom:1mm; } .label-txt { color:#666; font-size:7pt; } .val { font-weight:bold; } .val-date { font-size:10pt; font-weight:bold; } .qr { text-align:center; margin:2mm 0; } .metodo { text-align:center; font-size:8pt; font-weight:bold; text-transform:uppercase; letter-spacing:1px; } .footer { display:flex; justify-content:space-between; font-size:6pt; color:#888; margin-top:1mm; }</style></head><body><div class="label"><div class="nome">${escapeHtml(lote.nomeProduto)}</div><div class="row"><span class="label-txt">PROD.</span><span class="val">${dataPt(lote.dataProducao)}</span></div><div class="row"><span class="label-txt">VAL.</span><span class="val val-date">${dataPt(lote.dataValidade)}</span></div><div class="row"><span class="label-txt">Qtd.</span><span class="val">${escapeHtml(Number(lote.quantidadeProduzida).toFixed(1))} ${escapeHtml(lote.unidade)}</span></div><div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&ecc=Q&data=${encodeURIComponent(url)}" width="80" height="80" /></div><div class="metodo">${escapeHtml(lote.metodoConservacao?.toUpperCase() ?? "")}</div><div class="footer"><span>${escapeHtml(lote.codigoLote)}</span><span>${escapeHtml(url.replace("https://", ""))}</span></div></div></body></html>`;
  const janela = window.open("", "_blank");
  if (janela) { janela.document.write(html); janela.document.close(); setTimeout(() => janela.print(), 500); }
}
