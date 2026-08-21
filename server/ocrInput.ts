import { z } from "zod";

/** A aplicação guarda ficheiros OCR no armazenamento interno e recebe URLs relativas. */
export const imagemArmazenamentoSchema = z.string()
  .min(1, "Indica a imagem da fatura.")
  .max(2048, "A referência da imagem é demasiado longa.")
  .refine((url) => url.startsWith("/manus-storage/"), {
    message: "A imagem deve ser um ficheiro guardado no armazenamento interno.",
  });
