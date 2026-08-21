import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";

export const uploadRouter = router({
  // Upload de imagem para OCR — recebe base64 e devolve URL
  uploadImagem: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
      nome: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1] ?? "jpg";
        const key = `ocr/${ctx.user?.id ?? "anon"}/${Date.now()}.${ext}`;
        const guardado = await storagePut(key, buffer, input.mimeType);
        return guardado;
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao guardar imagem: ${err.message}` });
      }
    }),
});
