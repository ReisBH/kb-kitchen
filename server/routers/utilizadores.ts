import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { roleProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, utilizadoresAutorizados } from "../../drizzle/schema";

// Head Chef and Admin can manage users
const userManagerProcedure = roleProcedure(["head_chef"]);

export const utilizadoresRouter = router({
  listarUtilizadores: userManagerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(users).orderBy(desc(users.lastSignedIn));
  }),

  listarAutorizados: userManagerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(utilizadoresAutorizados).orderBy(desc(utilizadoresAutorizados.createdAt));
  }),

  adicionarAutorizado: userManagerProcedure
    .input(z.object({
      openId: z.string().min(1).optional(),
      email: z.string().email().optional(),
      nome: z.string().min(1),
      role: z.enum(["admin", "head_chef", "sub_chefe", "cozinheiro"]),
      notas: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      if (!input.openId && !input.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fornece o OpenID ou o email do utilizador." });
      }
      // Head Chef cannot create Admin accounts
      if (ctx.user.role === "head_chef" && input.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "O Head Chef não pode criar contas de Administrador." });
      }
      await db.insert(utilizadoresAutorizados).values({
        openId: input.openId ?? null,
        email: input.email ?? null,
        nome: input.nome,
        role: input.role,
        notas: input.notas ?? null,
        criadoPor: ctx.user.id,
      } as any);
      if (input.openId) {
        await db.update(users).set({ role: input.role }).where(eq(users.openId, input.openId));
      }
      return { success: true };
    }),

  atualizarRole: userManagerProcedure
    .input(z.object({
      id: z.number(),
      role: z.enum(["admin", "head_chef", "sub_chefe", "cozinheiro"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [autorizado] = await db.select().from(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id)).limit(1);
      if (!autorizado) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });
      // Head Chef cannot change admin roles or promote to admin
      if (ctx.user.role === "head_chef") {
        if (autorizado.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Não podes alterar o perfil de um Administrador." });
        }
        if (input.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Não podes promover utilizadores a Administrador." });
        }
      }
      await db.update(utilizadoresAutorizados).set({ role: input.role }).where(eq(utilizadoresAutorizados.id, input.id));
      if (autorizado.openId) {
        await db.update(users).set({ role: input.role }).where(eq(users.openId, autorizado.openId));
      }
      return { success: true };
    }),

  toggleAtivo: userManagerProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [autorizado] = await db.select().from(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id)).limit(1);
      if (!autorizado) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });
      // Head Chef cannot deactivate admins
      if (ctx.user.role === "head_chef" && autorizado.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Não podes desactivar uma conta de Administrador." });
      }
      await db.update(utilizadoresAutorizados).set({ ativo: input.ativo }).where(eq(utilizadoresAutorizados.id, input.id));
      if (autorizado.openId) {
        await db.update(users).set({ ativo: input.ativo } as any).where(eq(users.openId, autorizado.openId));
      }
      return { success: true };
    }),

  remover: userManagerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [autorizado] = await db.select().from(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id)).limit(1);
      if (autorizado && ctx.user.role === "head_chef" && autorizado.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Não podes remover uma conta de Administrador." });
      }
      await db.delete(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id));
      return { success: true };
    }),

  meuPerfil: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return u ?? null;
  }),
});
