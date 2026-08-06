import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, utilizadoresAutorizados } from "../../drizzle/schema";

export const utilizadoresRouter = router({
  // List all users that have logged in
  listarUtilizadores: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(users).orderBy(desc(users.lastSignedIn));
  }),

  // List all authorized invites
  listarAutorizados: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(utilizadoresAutorizados).orderBy(desc(utilizadoresAutorizados.createdAt));
  }),

  // Add a new authorized user (invite)
  adicionarAutorizado: adminProcedure
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
      await db.insert(utilizadoresAutorizados).values({
        openId: input.openId ?? null,
        email: input.email ?? null,
        nome: input.nome,
        role: input.role,
        notas: input.notas ?? null,
        criadoPor: ctx.user.id,
      } as any);
      // If user already exists in users table, update their role
      if (input.openId) {
        await db.update(users).set({ role: input.role }).where(eq(users.openId, input.openId));
      }
      return { success: true };
    }),

  // Update role of an authorized user
  atualizarRole: adminProcedure
    .input(z.object({
      id: z.number(),
      role: z.enum(["admin", "head_chef", "sub_chefe", "cozinheiro"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [autorizado] = await db.select().from(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id)).limit(1);
      if (!autorizado) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });
      await db.update(utilizadoresAutorizados).set({ role: input.role }).where(eq(utilizadoresAutorizados.id, input.id));
      // Sync role to users table if they've already logged in
      if (autorizado.openId) {
        await db.update(users).set({ role: input.role }).where(eq(users.openId, autorizado.openId));
      }
      return { success: true };
    }),

  // Deactivate/activate an authorized user
  toggleAtivo: adminProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [autorizado] = await db.select().from(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id)).limit(1);
      if (!autorizado) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });
      await db.update(utilizadoresAutorizados).set({ ativo: input.ativo }).where(eq(utilizadoresAutorizados.id, input.id));
      // Sync to users table
      if (autorizado.openId) {
        await db.update(users).set({ ativo: input.ativo } as any).where(eq(users.openId, autorizado.openId));
      }
      return { success: true };
    }),

  // Remove an authorized user
  remover: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.delete(utilizadoresAutorizados).where(eq(utilizadoresAutorizados.id, input.id));
      return { success: true };
    }),

  // Current user's own profile (for checking role on frontend)
  meuPerfil: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return u ?? null;
  }),
});

