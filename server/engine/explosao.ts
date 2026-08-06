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
  quantidade: number; // na unidade base
  unidade: string;
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

  // Verificar se o componente é uma receita base
  const [artigo] = await db.select().from(artigos).where(eq(artigos.id, componenteId)).limit(1);
  if (!artigo || artigo.tipo !== "receita_base") return false;

  // Buscar componentes desta receita
  const componentes = await db
    .select()
    .from(receitasBaseComponentes)
    .where(eq(receitasBaseComponentes.receitaId, componenteId));

  for (const comp of componentes) {
    if (await detetarCiclo(receitaId, comp.componenteId, new Set(visitados))) {
      return true;
    }
  }
  return false;
}

/** Explode uma ficha técnica em árvore de componentes com custos */
export async function explodirFicha(
  fichaId: number,
  doses: number = 1,
  nivel: number = 0
): Promise<NoExplosao[]> {
  if (nivel > MAX_PROFUNDIDADE) throw new Error("Profundidade máxima de explosão atingida");

  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  const componentes = await db
    .select()
    .from(fichasTecnicasComponentes)
    .where(eq(fichasTecnicasComponentes.fichaId, fichaId))
    .orderBy(fichasTecnicasComponentes.ordem);

  const nos: NoExplosao[] = [];
  for (const comp of componentes) {
    const [artigo] = await db.select().from(artigos).where(eq(artigos.id, comp.componenteId)).limit(1);
    if (!artigo) continue;

    const qtdBase = converterParaUnidadeBase(
      parseFloat(comp.quantidade) * doses,
      comp.unidade,
      artigo.unidadeBase,
      parseFloat(artigo.fatorConversao ?? "1"),
      artigo.densidade ? parseFloat(artigo.densidade) : null
    );
    const custo = parseFloat(artigo.custoMedioPonderado ?? "0");

    const no: NoExplosao = {
      artigoId: artigo.id,
      nome: artigo.nome,
      tipo: artigo.tipo,
      quantidade: qtdBase,
      unidade: artigo.unidadeBase,
      custoUnitario: custo,
      custoTotal: qtdBase * custo,
      nivel,
    };

    if (artigo.tipo === "receita_base") {
      no.filhos = await explodirReceita(artigo.id, qtdBase, nivel + 1);
    }
    nos.push(no);
  }
  return nos;
}

/** Explode uma receita base em componentes */
export async function explodirReceita(
  receitaId: number,
  quantidade: number,
  nivel: number = 0
): Promise<NoExplosao[]> {
  if (nivel > MAX_PROFUNDIDADE) throw new Error("Profundidade máxima de explosão atingida");

  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  const [receita] = await db.select().from(artigos).where(eq(artigos.id, receitaId)).limit(1);
  if (!receita || !receita.rendimentoEsperado) return [];

  const fatorEscala = quantidade / parseFloat(receita.rendimentoEsperado);

  const componentes = await db
    .select()
    .from(receitasBaseComponentes)
    .where(eq(receitasBaseComponentes.receitaId, receitaId))
    .orderBy(receitasBaseComponentes.ordem);

  const nos: NoExplosao[] = [];
  for (const comp of componentes) {
    const [artigo] = await db.select().from(artigos).where(eq(artigos.id, comp.componenteId)).limit(1);
    if (!artigo) continue;

    const qtdBase = converterParaUnidadeBase(
      parseFloat(comp.quantidade) * fatorEscala,
      comp.unidade,
      artigo.unidadeBase,
      parseFloat(artigo.fatorConversao ?? "1"),
      artigo.densidade ? parseFloat(artigo.densidade) : null
    );
    const custo = parseFloat(artigo.custoMedioPonderado ?? "0");

    const no: NoExplosao = {
      artigoId: artigo.id,
      nome: artigo.nome,
      tipo: artigo.tipo,
      quantidade: qtdBase,
      unidade: artigo.unidadeBase,
      custoUnitario: custo,
      custoTotal: qtdBase * custo,
      nivel,
    };

    if (artigo.tipo === "receita_base") {
      no.filhos = await explodirReceita(artigo.id, qtdBase, nivel + 1);
    }
    nos.push(no);
  }
  return nos;
}

/** Calcula o custo total de uma ficha técnica por dose */
export async function calcularCustoFicha(fichaId: number): Promise<number> {
  const nos = await explodirFicha(fichaId, 1);
  return calcularCustoNos(nos);
}

function calcularCustoNos(nos: NoExplosao[]): number {
  return nos.reduce((acc, no) => acc + no.custoTotal, 0);
}

/**
 * Executa a explosão de stock para uma venda (transacional)
 * Regista movimentos de consumo para todos os componentes
 */
export async function executarExplosaoVenda(input: {
  fichaId: number;
  doses: number;
  vendaId: number;
  utilizadorId?: number;
  comportamento: "auto" | "sempre" | "nunca";
}): Promise<{ movimentos: number[]; stockNegativo: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  const movimentosIds: number[] = [];
  const stockNegativo: string[] = [];
  const documentoId = `venda_${input.vendaId}`;

  async function processarNo(no: NoExplosao): Promise<void> {
    const [artigo] = await db!.select().from(artigos).where(eq(artigos.id, no.artigoId)).limit(1);
    if (!artigo) return;

    if (artigo.tipo === "receita_base" && input.comportamento !== "sempre") {
      // Verificar se há stock do subproduto
      const stockAtual = await calcularStock(no.artigoId);
      if (stockAtual >= no.quantidade || input.comportamento === "nunca") {
        // Consumir do stock do subproduto
        const { movimentoId } = await registarMovimento({
          artigoId: no.artigoId,
          tipo: "venda_consumo",
          quantidade: -no.quantidade,
          custoUnitario: no.custoUnitario,
          documentoId,
          documentoTipo: "venda",
          utilizadorId: input.utilizadorId,
        });
        movimentosIds.push(movimentoId);
        const stockApos = stockAtual - no.quantidade;
        if (stockApos < 0) stockNegativo.push(`${artigo.nome} (stock: ${stockApos.toFixed(3)} ${artigo.unidadeBase})`);
        return;
      }
    }

    // Explodir para componentes
    if (no.filhos && no.filhos.length > 0) {
      for (const filho of no.filhos) {
        await processarNo(filho);
      }
    } else {
      // Componente folha — consumir diretamente
      const stockAtual = await calcularStock(no.artigoId);
      const { movimentoId } = await registarMovimento({
        artigoId: no.artigoId,
        tipo: "venda_consumo",
        quantidade: -no.quantidade,
        custoUnitario: no.custoUnitario,
        documentoId,
        documentoTipo: "venda",
        utilizadorId: input.utilizadorId,
      });
      movimentosIds.push(movimentoId);
      const stockApos = stockAtual - no.quantidade;
      if (stockApos < 0) stockNegativo.push(`${artigo.nome} (stock: ${stockApos.toFixed(3)} ${artigo.unidadeBase})`);
    }
  }

  const [ficha] = await db.select().from(fichasTecnicas).where(eq(fichasTecnicas.id, input.fichaId)).limit(1);
  if (!ficha) throw new Error("Ficha técnica não encontrada");

  const nos = await explodirFicha(input.fichaId, input.doses);
  for (const no of nos) {
    await processarNo(no);
  }

  return { movimentos: movimentosIds, stockNegativo };
}
