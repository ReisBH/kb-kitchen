import { and, eq, gte, lte, desc, inArray } from "drizzle-orm";
import { artigos, configuracoesSupervisao, lotes, movimentos, notificacoesOperacionais, relatoriosOperacionais, users } from "../../drizzle/schema";

type Db = any;
type Severidade = "informacao" | "atencao" | "critica";
type TipoNotificacao = "aprovacao_pendente" | "validade_proxima" | "lote_expirado" | "relatorio_diario";

const ROLES_SUPERVISAO = ["admin", "head_chef", "sub_chefe"] as const;
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function dataLisboa(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(data);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export async function obterConfiguracaoSupervisao(db: Db) {
  const [configuracao] = await db.select().from(configuracoesSupervisao).limit(1);
  if (configuracao) return configuracao;
  const [resultado] = await db.insert(configuracoesSupervisao).values({} as any);
  const [criada] = await db.select().from(configuracoesSupervisao).where(eq(configuracoesSupervisao.id, Number(resultado.insertId))).limit(1);
  return criada!;
}

async function destinatariosInternos(db: Db) {
  return db.select({ id: users.id, role: users.role, email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.ativo, true), inArray(users.role, ROLES_SUPERVISAO as any)));
}

async function emailsChefias(db: Db): Promise<string[]> {
  const internos = await destinatariosInternos(db);
  const emails: string[] = (internos as any[]).filter((u: any) => u.role === "admin" && u.email).map((u: any) => u.email!.trim().toLowerCase());
  const headChef = (process.env.BREVO_HEAD_CHEF_EMAIL ?? process.env.RESEND_HEAD_CHEF_EMAIL ?? "diegogarcapd@gmail.com").trim().toLowerCase();
  if (headChef) emails.push(headChef);
  return Array.from(new Set(emails));
}

export async function enviarEmailBrevo(db: Db, assunto: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { enviado: false, motivo: "Brevo sem chave API configurada" };
  const destinatarios = await emailsChefias(db);
  if (!destinatarios.length) return { enviado: false, motivo: "Sem destinatários de chefia" };
  try {
    const resposta = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(construirPedidoEmailBrevo(destinatarios, assunto, html)),
    });
    if (!resposta.ok) return { enviado: false, motivo: `Brevo respondeu ${resposta.status}` };
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: String(erro) };
  }
}

export function construirPedidoEmailBrevo(destinatarios: string[], assunto: string, html: string) {
  return {
    sender: { name: "CozinhaKabuki", email: "cozinhakabuki@gmail.com" },
    to: destinatarios.map((email) => ({ email })),
    subject: assunto,
    htmlContent: html,
  };
}

export async function criarNotificacaoGestao(db: Db, input: { tipo: TipoNotificacao; severidade: Severidade; titulo: string; mensagem: string; url?: string; chaveDedupe: string; enviarEmail?: boolean }) {
  const destinatarios = await destinatariosInternos(db);
  if (destinatarios.length) {
    await db.insert(notificacoesOperacionais).values(destinatarios.map((u: any) => ({ utilizadorId: u.id, tipo: input.tipo, severidade: input.severidade, titulo: input.titulo, mensagem: input.mensagem, url: input.url ?? null, chaveDedupe: input.chaveDedupe })) as any)
      .onDuplicateKeyUpdate({ set: { titulo: input.titulo, mensagem: input.mensagem, severidade: input.severidade, url: input.url ?? null } });
  }
  if (input.enviarEmail) {
    const email = await enviarEmailBrevo(db, `[KB Kitchen] ${input.titulo}`, `<main style="font-family:Arial,sans-serif;color:#1f2937"><h2>${escapeHtml(input.titulo)}</h2><p>${escapeHtml(input.mensagem)}</p>${input.url ? `<p><a href="${escapeHtml(input.url)}">Abrir no KB Kitchen</a></p>` : ""}</main>`);
    if (email.enviado && destinatarios.length) await db.update(notificacoesOperacionais).set({ emailEnviadoEm: new Date() }).where(and(eq(notificacoesOperacionais.chaveDedupe, input.chaveDedupe), inArray(notificacoesOperacionais.utilizadorId, destinatarios.map((u: any) => u.id))));
    return email;
  }
  return { enviado: false };
}

export async function notificarAprovacaoPendente(db: Db, input: { tipo: "producao" | "inventario"; entidadeId: number; nome: string }) {
  const eInventario = input.tipo === "inventario";
  return criarNotificacaoGestao(db, {
    tipo: "aprovacao_pendente",
    severidade: eInventario ? "critica" : "atencao",
    titulo: eInventario ? "Inventário crítico aguarda aprovação" : "Produção aguarda aprovação",
    mensagem: `${input.nome} requer decisão de uma segunda chefia antes de ${eInventario ? "aplicar ajustes de stock" : "produzir o lote"}.`,
    url: "/aprovacoes",
    chaveDedupe: `aprovacao-${input.tipo}-${input.entidadeId}`,
    enviarEmail: true,
  });
}

export async function gerarRelatorioDiarioSupervisao(db: Db) {
  const dataReferencia = dataLisboa();
  const dataReferenciaDate = new Date(`${dataReferencia}T00:00:00.000Z`);
  const [existente] = await db.select().from(relatoriosOperacionais).where(and(eq(relatoriosOperacionais.tipo, "diario_validade_desperdicio"), eq(relatoriosOperacionais.dataReferencia, dataReferenciaDate))).limit(1);
  if (existente) return { relatorio: existente, idempotente: true, enviadoEmail: Boolean(existente.enviadoEm) };
  const configuracao = await obterConfiguracaoSupervisao(db);
  const dias = Math.max(1, Number(configuracao.alertaValidadeDias));
  const alvo = new Date(`${dataReferencia}T00:00:00.000Z`);
  alvo.setUTCDate(alvo.getUTCDate() + dias);
  const inicio = new Date(); inicio.setUTCDate(inicio.getUTCDate() - 1);
  const desperdicios = await db.select({ id: movimentos.id, artigoNome: artigos.nome, codigoLote: lotes.codigoLote, quantidade: movimentos.quantidade, custoUnitario: movimentos.custoUnitario, motivo: movimentos.motivo, dataMovimento: movimentos.dataMovimento })
    .from(movimentos).leftJoin(artigos, eq(movimentos.artigoId, artigos.id)).leftJoin(lotes, eq(movimentos.loteId, lotes.id))
    .where(and(eq(movimentos.tipo, "quebra"), gte(movimentos.dataMovimento, inicio))).orderBy(desc(movimentos.dataMovimento));
  const validade = await db.select({ id: lotes.id, codigoLote: lotes.codigoLote, nomeProduto: artigos.nome, dataValidade: lotes.dataValidade, quantidadeRestante: lotes.quantidadeRestante, unidade: lotes.unidade })
    .from(lotes).leftJoin(artigos, eq(lotes.artigoId, artigos.id))
    .where(and(eq(lotes.estado, "ativo"), gte(lotes.dataValidade, dataReferenciaDate), lte(lotes.dataValidade, alvo))).orderBy(lotes.dataValidade);
  const conteudoObj = { dataReferencia, diasValidade: dias, desperdicios: desperdicios.map((m: any) => ({ ...m, quantidade: Number(m.quantidade), custoUnitario: Number(m.custoUnitario) })), lotesProximos: validade.map((l: any) => ({ ...l, quantidadeRestante: Number(l.quantidadeRestante) })) };
  const [resultado] = await db.insert(relatoriosOperacionais).values({ tipo: "diario_validade_desperdicio", dataReferencia: dataReferenciaDate, conteudo: JSON.stringify(conteudoObj) } as any);
  const relatorioId = Number(resultado.insertId);
  const mensagem = `${desperdicios.length} registos de desperdício nas últimas 24 horas e ${validade.length} lotes a expirar nos próximos ${dias} dias.`;
  const email = await criarNotificacaoGestao(db, { tipo: "relatorio_diario", severidade: validade.length ? "atencao" : "informacao", titulo: `Resumo diário de stock — ${dataReferencia}`, mensagem, url: "/supervisao", chaveDedupe: `relatorio-diario-${dataReferencia}`, enviarEmail: true });
  if (email.enviado) await db.update(relatoriosOperacionais).set({ enviadoEm: new Date() }).where(eq(relatoriosOperacionais.id, relatorioId));
  const [relatorio] = await db.select().from(relatoriosOperacionais).where(eq(relatoriosOperacionais.id, relatorioId)).limit(1);
  return { relatorio, idempotente: false, enviadoEmail: email.enviado };
}
