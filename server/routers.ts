import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { fornecedoresRouter } from "./routers/fornecedores";
import { artigosRouter } from "./routers/artigos";
import { movimentosRouter } from "./routers/movimentos";
import { rendimentoRouter } from "./routers/rendimento";
import { receitasRouter } from "./routers/receitas";
import { fichasRouter } from "./routers/fichas";
import { inventarioRouter } from "./routers/inventario";
import { alertasRouter } from "./routers/alertas";
import { ocrRouter } from "./routers/ocr";
import { dashboardRouter } from "./routers/dashboard";
import { uploadRouter } from "./routers/upload";
import { utilizadoresRouter } from "./routers/utilizadores";
import { qrRouter } from "./routers/qr";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  fornecedores: fornecedoresRouter,
  artigos: artigosRouter,
  movimentos: movimentosRouter,
  rendimento: rendimentoRouter,
  receitas: receitasRouter,
  fichas: fichasRouter,
  inventario: inventarioRouter,
  alertas: alertasRouter,
  ocr: ocrRouter,
  dashboard: dashboardRouter,
  upload: uploadRouter,
  utilizadores: utilizadoresRouter,
  qr: qrRouter,
});

export type AppRouter = typeof appRouter;
