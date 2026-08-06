import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fornecedores } from "../../drizzle/schema";

export const fornecedoresRouter = router({
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(fornecedores).orderBy(fornecedores.nome);
  }),

  obter: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [f] = await db.select().from(fornecedores).where(eq(fornecedores.id, input.id)).limit(1);
    return f ?? null;
  }),

  criar: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      nif: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      telefone: z.string().optional(),
      morada: z.string().optional(),
      envioAutomatico: z.boolean().default(false),
      horaEnvio: z.string().default("08:00"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const [r] = await db.insert(fornecedores).values(input);
      return { id: (r as any).insertId };
    }),

  atualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1).optional(),
      nif: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      telefone: z.string().optional(),
      morada: z.string().optional(),
      envioAutomatico: z.boolean().optional(),
      horaEnvio: z.string().optional(),
      ativo: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      const { id, ...data } = input;
      await db.update(fornecedores).set(data).where(eq(fornecedores.id, id));
      return { success: true };
    }),

  eliminar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Base de dados não disponível");
      await db.update(fornecedores).set({ ativo: false }).where(eq(fornecedores.id, input.id));
      return { success: true };
    }),
});

