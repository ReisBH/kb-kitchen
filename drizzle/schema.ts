import {
  int, mysqlEnum, mysqlTable, text, timestamp, varchar, date,
  decimal, boolean, index, uniqueIndex
} from "drizzle-orm/mysql-core";

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "head_chef", "sub_chefe", "cozinheiro", "user"]).default("user").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── UTILIZADORES AUTORIZADOS ─────────────────────────────────────────────────
// Convites: o admin adiciona o openId/email e o role antes do utilizador fazer login
export const utilizadoresAutorizados = mysqlTable("utilizadores_autorizados", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  email: varchar("email", { length: 320 }),
  nome: varchar("nome", { length: 255 }),
  role: mysqlEnum("role", ["admin", "head_chef", "sub_chefe", "cozinheiro"]).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  notas: text("notas"),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UtilizadorAutorizado = typeof utilizadoresAutorizados.$inferSelect;
export type InsertUtilizadorAutorizado = typeof utilizadoresAutorizados.$inferInsert;

// ─── CREDENCIAIS LOCAIS ───────────────────────────────────────────────────────
// Username/password authentication independent of Manus OAuth
export const credenciaisLocais = mysqlTable("credenciais_locais", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  deveAlterarSenha: boolean("deveAlterarSenha").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CredencialLocal = typeof credenciaisLocais.$inferSelect;
export type InsertCredencialLocal = typeof credenciaisLocais.$inferInsert;

// ─── FORNECEDORES ─────────────────────────────────────────────────────────────
export const fornecedores = mysqlTable("fornecedores", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  nif: varchar("nif", { length: 20 }),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 30 }),
  morada: text("morada"),
  envioAutomatico: boolean("envioAutomatico").default(false).notNull(),
  horaEnvio: varchar("horaEnvio", { length: 5 }).default("08:00"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Fornecedor = typeof fornecedores.$inferSelect;
export type InsertFornecedor = typeof fornecedores.$inferInsert;

// ─── ARTIGOS ──────────────────────────────────────────────────────────────────
// Ingredientes, proteínas limpas e receitas base partilham esta tabela
export const artigos = mysqlTable("artigos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  // QR Code: código curto permanente (Crockford base32, 6 chars)
  codigoCurto: varchar("codigoCurto", { length: 8 }).unique(),
  // Tipo de etiqueta QR: prateleira (saída de stock), producao (lote), ambas, nenhuma
  tipoEtiqueta: mysqlEnum("tipoEtiqueta", ["prateleira", "producao", "ambas", "nenhuma"]).default("ambas").notNull(),
  tipo: mysqlEnum("tipo", ["ingrediente", "proteina_limpa", "receita_base"]).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  // Unidade base em que o stock é contado (g, ml, un)
  unidadeBase: varchar("unidadeBase", { length: 20 }).notNull(),
  // Unidade de compra e fator de conversão para unidade base
  unidadeCompra: varchar("unidadeCompra", { length: 20 }),
  fatorConversao: decimal("fatorConversao", { precision: 12, scale: 6 }).default("1"),
  // Densidade para conversão peso↔volume (g/ml)
  densidade: decimal("densidade", { precision: 10, scale: 4 }),
  // Níveis de stock
  stockMinimo: decimal("stockMinimo", { precision: 12, scale: 3 }).default("0"),
  stockMaximo: decimal("stockMaximo", { precision: 12, scale: 3 }),
  pontoEncomenda: decimal("pontoEncomenda", { precision: 12, scale: 3 }),
  // Custo médio ponderado (na unidade base)
  custoMedioPonderado: decimal("custoMedioPonderado", { precision: 12, scale: 6 }).default("0"),
  // Fornecedor preferencial
  fornecedorId: int("fornecedorId"),
  prazoEntregaDias: int("prazoEntregaDias").default(1),
  // Flags
  perecivel: boolean("perecivel").default(false).notNull(),
  validadeDias: int("validadeDias"),
  ativo: boolean("ativo").default(true).notNull(),
  // Para proteínas: indica se o produto chega inteiro e requer limpeza manual
  requerLimpeza: boolean("requerLimpeza").default(false).notNull(),
  // Alergénios (bitmask dos 14 alergénios europeus)
  alergenios: int("alergenios").default(0),
  // Para proteínas limpas: referência ao artigo bruto
  artigoBrutoId: int("artigoBrutoId"),
  // Para receitas base: rendimento esperado e unidade do produto final
  rendimentoEsperado: decimal("rendimentoEsperado", { precision: 12, scale: 3 }),
  validadeProducaoDias: int("validadeProducaoDias"),
  tempoPrepMin: int("tempoPrepMin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("artigos_tipo_idx").on(t.tipo),
  index("artigos_fornecedor_idx").on(t.fornecedorId),
  index("artigos_codigo_curto_idx").on(t.codigoCurto),
]);
export type Artigo = typeof artigos.$inferSelect;
export type InsertArtigo = typeof artigos.$inferInsert;

// ─── MOVIMENTOS (Livro de Movimentos — append-only) ───────────────────────────
export const movimentos = mysqlTable("movimentos", {
  id: int("id").autoincrement().primaryKey(),
  artigoId: int("artigoId").notNull(),
  tipo: mysqlEnum("tipo", [
    "entrada_compra",
    "producao_consumo",
    "producao_entrada",
    "venda_consumo",
    "quebra",
    "transformacao_saida",
    "transformacao_entrada",
    "ajuste_inventario",
  ]).notNull(),
  // Quantidade na unidade base (positivo = entrada, negativo = saída)
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 12, scale: 6 }).notNull(),
  // Custo médio ponderado após este movimento
  custoMedioApos: decimal("custoMedioApos", { precision: 12, scale: 6 }),
  // Stock após este movimento
  stockApos: decimal("stockApos", { precision: 12, scale: 3 }),
  // Referência ao documento de origem (fatura, venda, inventário, etc.)
  documentoId: varchar("documentoId", { length: 64 }),
  documentoTipo: varchar("documentoTipo", { length: 50 }),
  // Motivo (obrigatório para quebras)
  motivo: text("motivo"),
  utilizadorId: int("utilizadorId"),
  // Idempotency key (generated on mobile, prevents duplicate submissions)
  idCliente: varchar("idCliente", { length: 64 }).unique(),
  // Origin of the movement
  origem: mysqlEnum("origem", ["manual", "qr", "fatura", "fecho_caixa", "inventario", "producao", "sistema"]).default("manual"),
  // Anulado: if not null, this movement was cancelled by creating an inverse movement
  anuladoEm: timestamp("anuladoEm"),
  anuladoPorMovimentoId: int("anuladoPorMovimentoId"),
  dataMovimento: timestamp("dataMovimento").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("movimentos_artigo_idx").on(t.artigoId),
  index("movimentos_tipo_idx").on(t.tipo),
  index("movimentos_data_idx").on(t.dataMovimento),
  index("movimentos_documento_idx").on(t.documentoId),
  index("movimentos_idcliente_idx").on(t.idCliente),
]);
export type Movimento = typeof movimentos.$inferSelect;
export type InsertMovimento = typeof movimentos.$inferInsert;

// ─── TESTES DE RENDIMENTO (Proteínas) ─────────────────────────────────────────
export const testesRendimento = mysqlTable("testes_rendimento", {
  id: int("id").autoincrement().primaryKey(),
  artigoId: int("artigoId").notNull(), // artigo bruto
  artigoLimpoId: int("artigoLimpoId"), // artigo proteína_limpa resultante
  pesoBruto: decimal("pesoBruto", { precision: 10, scale: 3 }).notNull(),
  pesoLimpo: decimal("pesoLimpo", { precision: 10, scale: 3 }).notNull(),
  pesoAparas: decimal("pesoAparas", { precision: 10, scale: 3 }).default("0"),
  valorAparas: decimal("valorAparas", { precision: 10, scale: 4 }).default("0"),
  pesoDesperdicio: decimal("pesoDesperdicio", { precision: 10, scale: 3 }).default("0"),
  precoKgBruto: decimal("precoKgBruto", { precision: 10, scale: 4 }).notNull(),
  // Calculados
  aproveitamentoPct: decimal("aproveitamentoPct", { precision: 6, scale: 3 }),
  perdaPct: decimal("perdaPct", { precision: 6, scale: 3 }),
  custoRealPorKg: decimal("custoRealPorKg", { precision: 12, scale: 4 }),
  sobrecusto: decimal("sobrecusto", { precision: 12, scale: 4 }),
  // Referência ao par de movimentos de transformação
  movimentoSaidaId: int("movimentoSaidaId"),
  movimentoEntradaId: int("movimentoEntradaId"),
  utilizadorId: int("utilizadorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("testes_artigo_idx").on(t.artigoId),
]);
export type TesteRendimento = typeof testesRendimento.$inferSelect;
export type InsertTesteRendimento = typeof testesRendimento.$inferInsert;

// ─── RECEITAS BASE — COMPONENTES ──────────────────────────────────────────────
export const receitasBaseComponentes = mysqlTable("receitas_base_componentes", {
  id: int("id").autoincrement().primaryKey(),
  receitaId: int("receitaId").notNull(), // artigo do tipo receita_base
  componenteId: int("componenteId").notNull(), // artigo (qualquer tipo)
  quantidade: decimal("quantidade", { precision: 12, scale: 4 }).notNull(),
  unidade: varchar("unidade", { length: 20 }).notNull(),
  ordem: int("ordem").default(0),
}, (t) => [
  index("rbc_receita_idx").on(t.receitaId),
  index("rbc_componente_idx").on(t.componenteId),
]);
export type ReceitaBaseComponente = typeof receitasBaseComponentes.$inferSelect;
export type InsertReceitaBaseComponente = typeof receitasBaseComponentes.$inferInsert;

// ─── PRODUÇÕES (Registo de produção de receitas base) ─────────────────────────
export const producoes = mysqlTable("producoes", {
  id: int("id").autoincrement().primaryKey(),
  receitaId: int("receitaId").notNull(),
  quantidadeProduzida: decimal("quantidadeProduzida", { precision: 12, scale: 3 }).notNull(),
  rendimentoReal: decimal("rendimentoReal", { precision: 12, scale: 3 }),
  rendimentoEsperado: decimal("rendimentoEsperado", { precision: 12, scale: 3 }),
  desvioPct: decimal("desvioPct", { precision: 6, scale: 3 }),
  custoLote: decimal("custoLote", { precision: 12, scale: 4 }),
  utilizadorId: int("utilizadorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("producoes_receita_idx").on(t.receitaId),
]);
export type Producao = typeof producoes.$inferSelect;
export type InsertProducao = typeof producoes.$inferInsert;

// ─── FICHAS TÉCNICAS ──────────────────────────────────────────────────────────
export const fichasTecnicas = mysqlTable("fichas_tecnicas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  secaoMenu: varchar("secaoMenu", { length: 100 }),
  precoVenda: decimal("precoVenda", { precision: 10, scale: 2 }),
  foodCostAlvo: decimal("foodCostAlvo", { precision: 5, scale: 2 }),
  tempoPrepMin: int("tempoPrepMin"),
  fotoUrl: text("fotoUrl"),
  modoPreparacao: text("modoPreparacao"),
  alergenios: int("alergenios").default(0),
  ativo: boolean("ativo").default(true).notNull(),
  // Comportamento de explosão de receitas base
  explodir_receitas: mysqlEnum("explodir_receitas", ["auto", "sempre", "nunca"]).default("auto"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FichaTecnica = typeof fichasTecnicas.$inferSelect;
export type InsertFichaTecnica = typeof fichasTecnicas.$inferInsert;

// ─── FICHAS TÉCNICAS — COMPONENTES ────────────────────────────────────────────
export const fichasTecnicasComponentes = mysqlTable("fichas_tecnicas_componentes", {
  id: int("id").autoincrement().primaryKey(),
  fichaId: int("fichaId").notNull(),
  componenteId: int("componenteId").notNull(), // artigo (qualquer tipo)
  quantidade: decimal("quantidade", { precision: 12, scale: 4 }).notNull(),
  unidade: varchar("unidade", { length: 20 }).notNull(),
  ordem: int("ordem").default(0),
}, (t) => [
  index("ftc_ficha_idx").on(t.fichaId),
  index("ftc_componente_idx").on(t.componenteId),
]);
export type FichaTecnicaComponente = typeof fichasTecnicasComponentes.$inferSelect;
export type InsertFichaTecnicaComponente = typeof fichasTecnicasComponentes.$inferInsert;

// ─── VENDAS ───────────────────────────────────────────────────────────────────
export const vendas = mysqlTable("vendas", {
  id: int("id").autoincrement().primaryKey(),
  data: timestamp("data").notNull(),
  origem: mysqlEnum("origem", ["manual", "ocr_pos"]).default("manual").notNull(),
  documentoOcrId: int("documentoOcrId"),
  totalReceita: decimal("totalReceita", { precision: 12, scale: 2 }),
  custoTotal: decimal("custoTotal", { precision: 12, scale: 4 }),
  foodCostPct: decimal("foodCostPct", { precision: 6, scale: 3 }),
  processada: boolean("processada").default(false).notNull(),
  utilizadorId: int("utilizadorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("vendas_data_idx").on(t.data),
]);
export type Venda = typeof vendas.$inferSelect;
export type InsertVenda = typeof vendas.$inferInsert;

export const vendaLinhas = mysqlTable("venda_linhas", {
  id: int("id").autoincrement().primaryKey(),
  vendaId: int("vendaId").notNull(),
  fichaId: int("fichaId").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 3 }).notNull(),
  precoUnitario: decimal("precoUnitario", { precision: 10, scale: 2 }),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }),
}, (t) => [
  index("vl_venda_idx").on(t.vendaId),
]);
export type VendaLinha = typeof vendaLinhas.$inferSelect;
export type InsertVendaLinha = typeof vendaLinhas.$inferInsert;

// ─── INVENTÁRIOS ──────────────────────────────────────────────────────────────
export const inventarios = mysqlTable("inventarios", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }),
  zona: varchar("zona", { length: 100 }),
  estado: mysqlEnum("estado", ["em_curso", "fechado"]).default("em_curso").notNull(),
  utilizadorId: int("utilizadorId"),
  fechadoEm: timestamp("fechadoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Inventario = typeof inventarios.$inferSelect;
export type InsertInventario = typeof inventarios.$inferInsert;

export const inventarioLinhas = mysqlTable("inventario_linhas", {
  id: int("id").autoincrement().primaryKey(),
  inventarioId: int("inventarioId").notNull(),
  artigoId: int("artigoId").notNull(),
  stockTeorico: decimal("stockTeorico", { precision: 12, scale: 3 }),
  stockReal: decimal("stockReal", { precision: 12, scale: 3 }),
  desvioQtd: decimal("desvioQtd", { precision: 12, scale: 3 }),
  desvioValor: decimal("desvioValor", { precision: 12, scale: 4 }),
  desvioPct: decimal("desvioPct", { precision: 6, scale: 3 }),
  ajusteMovimentoId: int("ajusteMovimentoId"),
}, (t) => [
  index("il_inventario_idx").on(t.inventarioId),
]);
export type InventarioLinha = typeof inventarioLinhas.$inferSelect;
export type InsertInventarioLinha = typeof inventarioLinhas.$inferInsert;

// ─── NOTAS DE ENCOMENDA ───────────────────────────────────────────────────────
export const notasEncomenda = mysqlTable("notas_encomenda", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 30 }).notNull().unique(),
  fornecedorId: int("fornecedorId").notNull(),
  estado: mysqlEnum("estado", ["rascunho", "aprovada", "enviada", "recebida"]).default("rascunho").notNull(),
  dataEntregaPretendida: timestamp("dataEntregaPretendida"),
  enviadaEm: timestamp("enviadaEm"),
  recebidaEm: timestamp("recebidaEm"),
  utilizadorId: int("utilizadorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("ne_fornecedor_idx").on(t.fornecedorId),
]);
export type NotaEncomenda = typeof notasEncomenda.$inferSelect;
export type InsertNotaEncomenda = typeof notasEncomenda.$inferInsert;

export const notasEncomendaLinhas = mysqlTable("notas_encomenda_linhas", {
  id: int("id").autoincrement().primaryKey(),
  notaId: int("notaId").notNull(),
  artigoId: int("artigoId").notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  unidade: varchar("unidade", { length: 20 }).notNull(),
  precoEstimado: decimal("precoEstimado", { precision: 10, scale: 4 }),
}, (t) => [
  index("nel_nota_idx").on(t.notaId),
]);
export type NotaEncomendaLinha = typeof notasEncomendaLinhas.$inferSelect;
export type InsertNotaEncomendaLinha = typeof notasEncomendaLinhas.$inferInsert;

// ─── DOCUMENTOS OCR ───────────────────────────────────────────────────────────
export const documentosOcr = mysqlTable("documentos_ocr", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["fatura", "fecho_caixa"]).notNull(),
  estado: mysqlEnum("estado", ["pendente", "extraido", "em_revisao", "confirmado", "erro"]).default("pendente").notNull(),
  imagemUrl: text("imagemUrl"),
  imagemKey: text("imagemKey"),
  // Dados extraídos pelo LLM
  dadosExtraidos: text("dadosExtraidos"), // JSON string
  fornecedorId: int("fornecedorId"),
  dataDocumento: timestamp("dataDocumento"),
  numeroDocumento: varchar("numeroDocumento", { length: 100 }),
  // Para fecho de caixa: referência à venda criada
  vendaId: int("vendaId"),
  utilizadorId: int("utilizadorId"),
  erroMsg: text("erroMsg"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DocumentoOcr = typeof documentosOcr.$inferSelect;
export type InsertDocumentoOcr = typeof documentosOcr.$inferInsert;

// ─── ALIASES DE FORNECEDOR (emparelhamento OCR → artigo) ──────────────────────
export const aliasesFornecedor = mysqlTable("aliases_fornecedor", {
  id: int("id").autoincrement().primaryKey(),
  fornecedorId: int("fornecedorId"),
  alias: varchar("alias", { length: 255 }).notNull(),
  artigoId: int("artigoId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("af_alias_fornecedor_idx").on(t.alias, t.fornecedorId),
]);
export type AliasFornecedor = typeof aliasesFornecedor.$inferSelect;
export type InsertAliasFornecedor = typeof aliasesFornecedor.$inferInsert;

// ─── MAPA POS (emparelhamento nome POS → ficha técnica) ───────────────────────
export const mapaPos = mysqlTable("mapa_pos", {
  id: int("id").autoincrement().primaryKey(),
  nomePos: varchar("nomePos", { length: 255 }).notNull().unique(),
  fichaId: int("fichaId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MapaPos = typeof mapaPos.$inferSelect;
export type InsertMapaPos = typeof mapaPos.$inferInsert;

// ─── LOTES (Produção identificada individualmente) ────────────────────────────
export const lotes = mysqlTable("lotes", {
  id: int("id").autoincrement().primaryKey(),
  codigoLote: varchar("codigoLote", { length: 10 }).notNull().unique(),
  // Pode ser artigo (ingrediente/proteina_limpa/receita_base) ou ficha técnica
  artigoId: int("artigoId"),
  fichaId: int("fichaId"),
  quantidadeProduzida: decimal("quantidadeProduzida", { precision: 12, scale: 3 }).notNull(),
  quantidadeRestante: decimal("quantidadeRestante", { precision: 12, scale: 3 }).notNull(),
  unidade: varchar("unidade", { length: 20 }).notNull(),
  dataProducao: timestamp("dataProducao").defaultNow().notNull(),
  dataValidade: date("dataValidade"),
  metodoConservacao: mysqlEnum("metodoConservacao", ["vacuo", "refrigerado", "congelado", "ambiente"]).notNull(),
  estado: mysqlEnum("estado", ["ativo", "esgotado", "expirado", "descartado"]).default("ativo").notNull(),
  utilizadorId: int("utilizadorId"),
  // For thawed products
  descongelado: boolean("descongelado").default(false).notNull(),
  // Rastreabilidade: JSON array of {artigoId, quantidade} used in production
  ingredientesUsados: text("ingredientesUsados"),
  // Link to the producao record if created from receita base
  producaoId: int("producaoId"),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("lotes_artigo_idx").on(t.artigoId),
  index("lotes_codigo_idx").on(t.codigoLote),
  index("lotes_estado_idx").on(t.estado),
  index("lotes_validade_idx").on(t.dataValidade),
]);
export type Lote = typeof lotes.$inferSelect;
export type InsertLote = typeof lotes.$inferInsert;

// ─── REGRAS DE VALIDADE ───────────────────────────────────────────────────────
export const regrasValidade = mysqlTable("regras_validade", {
  id: int("id").autoincrement().primaryKey(),
  artigoId: int("artigoId"),
  fichaId: int("fichaId"),
  metodoConservacao: mysqlEnum("metodoConservacao", ["vacuo", "refrigerado", "congelado", "ambiente"]).notNull(),
  diasValidade: int("diasValidade").notNull(),
  // Only a gestor can shorten validity, never extend
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("rv_artigo_idx").on(t.artigoId),
]);
export type RegraValidade = typeof regrasValidade.$inferSelect;
export type InsertRegraValidade = typeof regrasValidade.$inferInsert;

// ─── SESSÕES PIN (autenticação rápida para QR) ────────────────────────────────
export const sessoesPinQr = mysqlTable("sessoes_pin_qr", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  revogadaEm: timestamp("revogadaEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("spq_user_idx").on(t.userId),
  index("spq_token_idx").on(t.tokenHash),
]);
export type SessaoPinQr = typeof sessoesPinQr.$inferSelect;
export type InsertSessaoPinQr = typeof sessoesPinQr.$inferInsert;
