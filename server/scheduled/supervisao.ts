import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { configuracoesSupervisao } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { gerarRelatorioDiarioSupervisao, obterConfiguracaoSupervisao } from "../services/supervisao";

function horaLisboa(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(data);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("hour")}:${valor("minute")}`;
}

export async function executarSupervisaoDiaria(req: Request, res: Response) {
  try {
    const utilizador = await sdk.authenticateRequest(req);
    if (!utilizador.isCron || !utilizador.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable" });
    const configuracao = await obterConfiguracaoSupervisao(db);
    if (configuracao.scheduleCronTaskUid !== utilizador.taskUid) return res.json({ ok: true, skipped: "orphan" });
    if (!configuracao.ativo) return res.json({ ok: true, skipped: "disabled" });
    const agora = horaLisboa();
    if (configuracao.relatorioHoraLisboa !== agora) return res.json({ ok: true, skipped: "outside-lisbon-window", agora, configurado: configuracao.relatorioHoraLisboa });
    const resultado = await gerarRelatorioDiarioSupervisao(db);
    await db.update(configuracoesSupervisao).set({ updatedAt: new Date() }).where(eq(configuracoesSupervisao.id, configuracao.id));
    return res.json({ ok: true, idempotente: resultado.idempotente, enviadoEmail: resultado.enviadoEmail });
  } catch (erro) {
    const detalhe = erro instanceof Error ? { message: erro.message, stack: erro.stack } : { message: String(erro) };
    return res.status(500).json({ error: "supervisao-diaria-failed", detalhe, timestamp: new Date().toISOString() });
  }
}
