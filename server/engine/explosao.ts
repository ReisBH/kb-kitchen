/**
 * Motor de explosão em cascata
 * Decompõe fichas técnicas e receitas base até à matéria-prima
 */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  artigos, fichasTecnicas, fichasTecnicasComponentes,
  receitasBaseComponentes, movimentos
} from "../../drizzle/schema";
import { registarMovimento, calcularStock, converterParaUnidadeBase } from "./stock";

export const MAX_PROFUNDIDADE = 6;

export interface NoExplosao {
  artigoId: number;
  nome: string;
  tipo: string;
  tipoReferencia?: "artigo" | "ficha";
  /** Quantidade nativa, usada em custos e movimentos de stock. */
  quantidade: number;
  /** Quantidade declarada na referência culinária, usada na interface. */
  quantidadeReferencia?: number;
  unidade: string;
  unidadeCusto?: string;
  custoUnitario: number;
  custoTotal: number;
  filhos?: NoExplosao[];
  nivel: number;
  stockInsuficiente?: boolean;
}

/** Deteta ciclos na árvore de composição de uma receita base */
export async function detetarCiclo(
  receitaId: number,
  componenteId: number,
  visitados: Set<number> = new Set()
): Promise<boolean> {
  if (componenteId === receitaId) return true;
  if (visitados.has(componenteId)) return false;
  visitados.add(componenteId);
  const db = await getDb();
  if (!db) return false;
  const [artigo] = await db.select().from(artigos).where(eq(artigos.id, componenteId)).limit(1);
  if (!artigo || artigo.tipo !== "receita_base") return false;
  const componentes = await db.select().from(receitasBaseComponentes).where(eq(receitasBaseComponentes.receitaId, componenteId));
  for (const comp of componentes) {
    if (await detetarCiclo(receitaId, comp.componenteId, new Set(visitados))) return true;
  }
  return false;
}

/** Deteta referências circulares entre fichas técnicas aninhadas. */
export async function detetarCicloFicha(
  fichaId: number,
  componenteFichaId: number,
  visitados: Set<number> = new Set()
): Promise<boolean> {
  if (componenteFichaId === fichaId) return true;
  if (visitados.has(componenteFichaId)) return false;
  visitados.add(componenteFichaId);
  const db = await getDb();
  if (!db) return false;
  const componentes = await db.select().from(fichasTecnicasComponentes)
    .where(eq(fichasTecnicasComponentes.fichaId, componenteFichaId));
  for (const componente of componentes) {
    if (componente.tipoComponente === "ficha" && await detetarCicloFicha(fichaId, componente.componenteId, new Set(visitados))) return true;
  }
  return false;
}

/** Explode uma ficha técnica em árvore de componentes com custos */
export async function explodirFicha(fichaId: number, doses: number = 1, nivel: number = 0): Promise<NoExplosao[]> {
  if (nivel > MAX_PROFUNDIDADE) throw new Error("Profundidade máxima de explosão atingida");
  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");
  const componentes = await db.select().from(fichasTecnicasComponentes).where(eq(fichasTecnicasComponentes.fichaId, fichaId)).orderBy(fichasTecnicasComponentes.ordem);
  const nos: NoExplosao[] = [];
  for (const comp of componentes) {
    if (comp.tipoComponente === "ficha") {
      const [fichaComponente] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, comp.componenteId)).limit(1);
      if (!fichaComponente) continue;
      const quantidadeReferencia = parseFloat(comp.quantidade) * doses;
      const filhos = await explodirFicha(fichaComponente.id, quantidadeReferencia, nivel + 1);
      const custoTotal = calcularCustoNos(filhos);
      nos.push({
        artigoId: fichaComponente.id,
        nome: fichaComponente.nome,
        tipo: "ficha_tecnica",
        tipoReferencia: "ficha",
        quantidade: quantidadeReferencia,
        quantidadeReferencia,
        unidade: comp.unidade,
        unidadeCusto: comp.unidade,
        custoUnitario: quantidadeReferencia > 0 ? custoTotal / quantidadeReferencia : 0,
        custoTotal,
        filhos,
        nivel,
      });
      continue;
    }
    const [artigo] = await db.select().from(artigos).where(eq(artigos.id, comp.componenteId)).limit(1);
    if (!artigo) continue;
    const quantidadeReferencia = parseFloat(comp.quantidade) * doses;
    const qtdBase = converterParaUnidadeBase(quantidadeReferencia, comp.unidade, artigo.unidadeBase, parseFloat(artigo.fatorConversao ?? "1"), artigo.densidade ? parseFloat(artigo.densidade) : null);
    const custo = parseFloat(artigo.custoMedioPonderado ?? "0");
    const no: NoExplosao = {
      artigoId: artigo.id,
      nome: artigo.nome,
      tipo: artigo.tipo,
      quantidade: qtdBase,
      quantidadeReferencia,
      unidade: comp.unidade,
      unidadeCusto: artigo.unidadeBase,
      custoUnitario: custo,
      custoTotal: qtdBase * custo,
      nivel,
    };
    if (artigo.tipo === "receita_base") no.filhos = await explodirReceita(artigo.id, qtdBase, nivel + 1);
    nos.push(no);
  }
  return nos;
}

/** Explode uma receita base em componentes */
export async function explodirReceita(receitaId: number, quantidade: number, nivel: number = 0): Promise<NoExplosao[]> {
  if (nivel > MAX_PROFUNDIDADE) throw new Error("Profundidade máxima de explosão atingida");
  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");
  const [receita] = await db.select().from(artigos).where(eq(artigos.id, receitaId)).limit(1);
  if (!receita || !receita.rendimentoEsperado) return [];
  const fatorEscala = quantidade / parseFloat(receita.rendimentoEsperado);
  const componentes = await db.select().from(receitasBaseComponentes).where(eq(receitasBaseComponentes.receitaId, receitaId)).orderBy(receitasBaseComponentes.ordem);
  const nos: NoExplosao[] = [];
  for (const comp of componentes) {
    const [artigo] = await db.select().from(artigos).where(eq(artigos.id, comp.componenteId)).limit(1);
    if (!artigo) continue;
    const quantidadeReferencia = parseFloat(comp.quantidade) * fatorEscala;
    const qtdBase = converterParaUnidadeBase(quantidadeReferencia, comp.unidade, artigo.unidadeBase, parseFloat(artigo.fatorConversao ?? "1"), artigo.densidade ? parseFloat(artigo.densidade) : null);
    const custo = parseFloat(artigo.custoMedioPonderado ?? "0");
    const no: NoExplosao = {
      artigoId: artigo.id,
      nome: artigo.nome,
      tipo: artigo.tipo,
      quantidade: qtdBase,
      quantidadeReferencia,
      unidade: comp.unidade,
      unidadeCusto: artigo.unidadeBase,
      custoUnitario: custo,
      custoTotal: qtdBase * custo,
      nivel,
    };
    if (artigo.tipo === "receita_base") no.filhos = await explodirReceita(artigo.id, qtdBase, nivel + 1);
    nos.push(no);
  }
  return nos;
}

/** Calcula o custo total de uma ficha técnica por dose */
export async function calcularCustoFicha(fichaId: number): Promise<number> {
  return calcularCustoNos(await explodirFicha(fichaId, 1));
}

/** Soma os custos no nível mais baixo disponível da composição. */
export function calcularCustoNos(nos: NoExplosao[]): number {
  return nos.reduce((acc, no) => acc + (no.filhos?.length ? calcularCustoNos(no.filhos) : no.custoTotal), 0);
}

/** Executa a explosão de stock para uma venda. */
export async function executarExplosaoVenda(input: {
  fichaId: number;
  doses: number;
  vendaId?: number | null;
  utilizadorId?: number;
  comportamento: "auto" | "sempre" | "nunca";
  tipoOverride?: "venda_consumo" | "quebra";
  motivo?: string;
  documentoId?: string;
  idClienteBase?: string;
  executor?: any;
}): Promise<{ movimentos: number[]; stockNegativo: string[] }> {
  const db = input.executor ?? await getDb();
  if (!db) throw new Error("Base de dados não disponível");
  const movimentosIds: number[] = [];
  const stockNegativo: string[] = [];
  const documentoId = input.documentoId ?? (input.vendaId ? `venda_${input.vendaId}` : `waste_${Date.now()}`);
  const tipoMovimento = input.tipoOverride ?? "venda_consumo";
  const motivoMovimento = input.motivo;
  let sequenciaMovimento = 0;
  const proximaChave = () => input.idClienteBase ? `${input.idClienteBase}:mov:${sequenciaMovimento++}` : undefined;

  async function processarNo(no: NoExplosao): Promise<void> {
    if (no.tipoReferencia === "ficha") {
      for (const filho of no.filhos ?? []) await processarNo(filho);
      return;
    }
    const [artigo] = await db!.select().from(artigos).where(eq(artigos.id, no.artigoId)).limit(1);
    if (!artigo) return;
    if (artigo.tipo === "receita_base" && input.comportamento !== "sempre") {
      const stockAtual = await calcularStock(no.artigoId, db as any);
      if (stockAtual >= no.quantidade || input.comportamento === "nunca") {
        const { movimentoId } = await registarMovimento({ artigoId: no.artigoId, tipo: tipoMovimento, quantidade: -no.quantidade, custoUnitario: no.custoUnitario, documentoId, documentoTipo: "venda", motivo: motivoMovimento, utilizadorId: input.utilizadorId, origem: "sistema", idCliente: proximaChave() }, db as any);
        movimentosIds.push(movimentoId);
        const stockApos = stockAtual - no.quantidade;
        if (stockApos < 0) stockNegativo.push(`${artigo.nome} (stock: ${stockApos.toFixed(3)} ${artigo.unidadeBase})`);
        return;
      }
    }
    if (no.filhos?.length) {
      for (const filho of no.filhos) await processarNo(filho);
    } else {
      const stockAtual = await calcularStock(no.artigoId, db as any);
      const { movimentoId } = await registarMovimento({ artigoId: no.artigoId, tipo: tipoMovimento, quantidade: -no.quantidade, custoUnitario: no.custoUnitario, documentoId, documentoTipo: "venda", motivo: motivoMovimento, utilizadorId: input.utilizadorId, origem: "sistema", idCliente: proximaChave() }, db as any);
      movimentosIds.push(movimentoId);
      const stockApos = stockAtual - no.quantidade;
      if (stockApos < 0) stockNegativo.push(`${artigo.nome} (stock: ${stockApos.toFixed(3)} ${artigo.unidadeBase})`);
    }
  }

  const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.fichaId)).limit(1);
  if (!ficha) throw new Error("Ficha técnica não encontrada");
  for (const no of await explodirFicha(input.fichaId, input.doses)) await processarNo(no);
  return { movimentos: movimentosIds, stockNegativo };
}
