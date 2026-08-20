import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { roleProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { configuracoesSupervisao, notificacoesOperacionais, relatoriosOperacionais } from "../../drizzle/schema";
import { gerarRelatorioDiarioSupervisao, obterConfiguracaoSupervisao } from "../services/supervisao";

export const supervisaoRouter = router({
  configuracao: roleProcedure(["head_chef"]).query(async () => {
    const db = await getDb(); if (!db) throw new Error("Base de dados não disponível");
    return obterConfiguracaoSupervisao(db);
  }),
  atualizarConfiguracao: roleProcedure(["head_chef"]).input(z.object({ desvioInventarioCriticoPct: z.number().min(0.1).max(100), alertaValidadeDias: z.number().int().min(1).max(30), relatorioHoraLisboa: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })).mutation(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) throw new Error("Base de dados não disponível");
    const atual = await obterConfiguracaoSupervisao(db);
    await db.update(configuracoesSupervisao).set({ ...input, desvioInventarioCriticoPct: input.desvioInventarioCriticoPct.toFixed(3), atualizadoPor: ctx.user!.id }).where(eq(configuracoesSupervisao.id, atual.id));
    return { success: true };
  }),
  minhasNotificacoes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); if (!db) return [];
    return db.select().from(notificacoesOperacionais).where(eq(notificacoesOperacionais.utilizadorId, ctx.user!.id)).orderBy(desc(notificacoesOperacionais.createdAt)).limit(100);
  }),
  marcarLida: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb(); if (!db) throw new Error("Base de dados não disponível");
    await db.update(notificacoesOperacionais).set({ lidaEm: new Date() }).where(and(eq(notificacoesOperacionais.id, input.id), eq(notificacoesOperacionais.utilizadorId, ctx.user!.id)));
    return { success: true };
  }),
  pendentes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); if (!db) return 0;
    const linhas = await db.select({ id: notificacoesOperacionais.id }).from(notificacoesOperacionais).where(and(eq(notificacoesOperacionais.utilizadorId, ctx.user!.id), isNull(notificacoesOperacionais.lidaEm)));
    return linhas.length;
  }),
  ultimoRelatorio: protectedProcedure.query(async () => {
    const db = await getDb(); if (!db) return null;
    const [relatorio] = await db.select().from(relatoriosOperacionais).orderBy(desc(relatoriosOperacionais.dataReferencia)).limit(1);
    return relatorio ? { ...relatorio, conteudo: JSON.parse(relatorio.conteudo) } : null;
  }),
  gerarRelatorioAgora: roleProcedure(["head_chef"]).mutation(async () => {
    const db = await getDb(); if (!db) throw new Error("Base de dados não disponível");
    return gerarRelatorioDiarioSupervisao(db);
  }),
});
