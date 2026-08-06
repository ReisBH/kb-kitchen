/**
 * Seed de dados realistas para um restaurante português
 * Executa: node server/seed.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── FORNECEDORES ─────────────────────────────────────────────────────────────
await conn.execute(`INSERT IGNORE INTO fornecedores (id, nome, nif, email, telefone, envioAutomatico) VALUES
  (1, 'Makro Portugal', '500123456', 'encomendas@makro.pt', '+351 21 000 0000', 0),
  (2, 'Peixaria Central Lda', '509876543', 'peixaria@central.pt', '+351 22 111 2222', 0),
  (3, 'Horticola do Tejo', '512345678', 'pedidos@horticola.pt', '+351 21 333 4444', 0)`);

// ─── ARTIGOS — INGREDIENTES ───────────────────────────────────────────────────
const ingredientes = [
  // Carnes e aves
  [1, "Frango inteiro", "ingrediente", "Carnes e Aves", "g", "un", 1800, null, 500, 5000, 1000, 2.80, 1, 1, true, 5],
  [2, "Peito de frango", "ingrediente", "Carnes e Aves", "g", "kg", 1000, null, 300, 3000, 600, 6.50, 1, 1, true, 5],
  [3, "Lombo de porco", "ingrediente", "Carnes e Aves", "g", "kg", 1000, null, 500, 5000, 1000, 5.20, 1, 2, true, 5],
  [4, "Entrecosto", "ingrediente", "Carnes e Aves", "g", "kg", 1000, null, 300, 3000, 600, 4.80, 1, 2, true, 5],
  // Peixe
  [5, "Bacalhau salgado seco", "ingrediente", "Peixe", "g", "kg", 1000, null, 1000, 10000, 2000, 9.50, 2, 3, true, 30],
  [6, "Salmão fresco", "ingrediente", "Peixe", "g", "kg", 1000, null, 500, 5000, 1000, 12.00, 2, 2, true, 3],
  [7, "Lulas frescas", "ingrediente", "Peixe", "g", "kg", 1000, null, 300, 3000, 600, 7.50, 2, 1, true, 2],
  [8, "Amêijoas", "ingrediente", "Peixe", "g", "kg", 1000, null, 200, 2000, 400, 8.00, 2, 1, true, 2],
  // Legumes
  [9, "Cebola", "ingrediente", "Legumes", "g", "kg", 1000, null, 1000, 10000, 2000, 0.60, 3, 2, true, 14],
  [10, "Alho", "ingrediente", "Legumes", "g", "kg", 1000, null, 200, 2000, 400, 3.50, 3, 2, false, 30],
  [11, "Tomate", "ingrediente", "Legumes", "g", "kg", 1000, null, 500, 5000, 1000, 1.20, 3, 1, true, 7],
  [12, "Tomate cherry em rama", "ingrediente", "Legumes", "g", "kg", 1000, null, 300, 3000, 600, 2.80, 3, 1, true, 7],
  [13, "Pimento vermelho", "ingrediente", "Legumes", "g", "kg", 1000, null, 300, 3000, 600, 1.80, 3, 1, true, 10],
  [14, "Pimento verde", "ingrediente", "Legumes", "g", "kg", 1000, null, 200, 2000, 400, 1.60, 3, 1, true, 10],
  [15, "Batata", "ingrediente", "Legumes", "g", "kg", 1000, null, 2000, 20000, 4000, 0.55, 3, 3, false, 21],
  [16, "Batata doce", "ingrediente", "Legumes", "g", "kg", 1000, null, 500, 5000, 1000, 1.20, 3, 3, false, 14],
  [17, "Cenoura", "ingrediente", "Legumes", "g", "kg", 1000, null, 500, 5000, 1000, 0.80, 3, 2, false, 14],
  [18, "Aipo", "ingrediente", "Legumes", "g", "kg", 1000, null, 200, 2000, 400, 1.50, 3, 2, true, 7],
  [19, "Courgette", "ingrediente", "Legumes", "g", "kg", 1000, null, 300, 3000, 600, 1.40, 3, 1, true, 7],
  [20, "Espinafres", "ingrediente", "Legumes", "g", "kg", 1000, null, 200, 2000, 400, 2.20, 3, 1, true, 5],
  // Ervas e aromáticos
  [21, "Salsa fresca", "ingrediente", "Ervas", "g", "un", 30, null, 30, 300, 60, 0.60, 3, 1, true, 5],
  [22, "Coentros frescos", "ingrediente", "Ervas", "g", "un", 30, null, 30, 300, 60, 0.60, 3, 1, true, 5],
  [23, "Tomilho seco", "ingrediente", "Ervas", "g", "kg", 1000, null, 100, 1000, 200, 8.00, 1, 7, false, 365],
  [24, "Louro", "ingrediente", "Ervas", "g", "kg", 1000, null, 50, 500, 100, 6.00, 1, 7, false, 365],
  [25, "Piri-piri seco", "ingrediente", "Ervas", "g", "kg", 1000, null, 100, 1000, 200, 12.00, 1, 7, false, 365],
  // Laticínios
  [26, "Manteiga", "ingrediente", "Laticínios", "g", "kg", 1000, null, 500, 5000, 1000, 6.00, 1, 3, true, 30],
  [27, "Natas", "ingrediente", "Laticínios", "ml", "l", 1000, null, 500, 5000, 1000, 1.80, 1, 3, true, 14],
  [28, "Queijo parmesão", "ingrediente", "Laticínios", "g", "kg", 1000, null, 200, 2000, 400, 18.00, 1, 5, true, 60],
  [29, "Ovo", "ingrediente", "Laticínios", "un", "cx12", 12, null, 12, 120, 24, 0.18, 1, 3, true, 21],
  // Óleos e gorduras
  [30, "Azeite virgem extra", "ingrediente", "Óleos", "ml", "l", 1000, null, 1000, 10000, 2000, 4.50, 1, 7, false, 365],
  [31, "Óleo de girassol", "ingrediente", "Óleos", "ml", "l", 1000, null, 1000, 10000, 2000, 1.20, 1, 7, false, 365],
  // Secos e conservas
  [32, "Arroz agulha", "ingrediente", "Secos", "g", "kg", 1000, null, 2000, 20000, 4000, 0.90, 1, 7, false, 365],
  [33, "Massa esparguete", "ingrediente", "Secos", "g", "kg", 1000, null, 1000, 10000, 2000, 1.10, 1, 7, false, 365],
  [34, "Farinha de trigo T55", "ingrediente", "Secos", "g", "kg", 1000, null, 2000, 20000, 4000, 0.65, 1, 7, false, 365],
  [35, "Açúcar branco", "ingrediente", "Secos", "g", "kg", 1000, null, 1000, 10000, 2000, 0.80, 1, 14, false, 365],
  [36, "Sal grosso", "ingrediente", "Secos", "g", "kg", 1000, null, 500, 5000, 1000, 0.40, 1, 14, false, 365],
  // Bebidas e vinhos
  [37, "Vinho tinto (cozinha)", "ingrediente", "Bebidas", "ml", "l", 1000, null, 750, 7500, 1500, 2.50, 1, 7, false, 365],
  [38, "Vinho branco (cozinha)", "ingrediente", "Bebidas", "ml", "l", 1000, null, 750, 7500, 1500, 2.20, 1, 7, false, 365],
  [39, "Vinagre de vinho branco", "ingrediente", "Bebidas", "ml", "l", 1000, null, 500, 5000, 1000, 1.50, 1, 14, false, 365],
  // Caldos e bases
  [40, "Caldo de galinha (concentrado)", "ingrediente", "Caldos", "ml", "l", 1000, null, 500, 5000, 1000, 3.20, 1, 7, false, 180],
  [41, "Polpa de tomate", "ingrediente", "Conservas", "g", "kg", 1000, null, 500, 5000, 1000, 1.80, 1, 7, false, 365],
  [42, "Lima", "ingrediente", "Frutas", "un", "un", 1, null, 10, 100, 20, 0.35, 3, 2, true, 14],
  [43, "Limão", "ingrediente", "Frutas", "un", "un", 1, null, 10, 100, 20, 0.25, 3, 2, true, 14],
  [44, "Mostarda Dijon", "ingrediente", "Condimentos", "g", "kg", 1000, null, 200, 2000, 400, 5.50, 1, 14, false, 365],
  [45, "Molho de soja", "ingrediente", "Condimentos", "ml", "l", 1000, null, 200, 2000, 400, 4.00, 1, 14, false, 365],
];

for (const [id, nome, tipo, cat, unBase, unCompra, fator, dens, sMin, sMax, pEnc, custo, forn, prazo, perec, validade] of ingredientes) {
  await conn.execute(
    `INSERT IGNORE INTO artigos (id, nome, tipo, categoria, unidadeBase, unidadeCompra, fatorConversao, densidade, stockMinimo, stockMaximo, pontoEncomenda, custoMedioPonderado, fornecedorId, prazoEntregaDias, perecivel, validadeDias, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, nome, tipo, cat, unBase, unCompra, fator, dens, sMin, sMax, pEnc, custo, forn, prazo, perec ? 1 : 0, validade]
  );
}

// ─── ARTIGOS — PROTEÍNAS LIMPAS ───────────────────────────────────────────────
await conn.execute(`INSERT IGNORE INTO artigos (id, nome, tipo, categoria, unidadeBase, custoMedioPonderado, artigoBrutoId, ativo) VALUES
  (50, 'Bacalhau limpo', 'proteina_limpa', 'Peixe', 'g', 15.83, 5, 1),
  (51, 'Salmão limpo', 'proteina_limpa', 'Peixe', 'g', 16.00, 6, 1),
  (52, 'Lulas limpas', 'proteina_limpa', 'Peixe', 'g', 11.25, 7, 1),
  (53, 'Frango limpo', 'proteina_limpa', 'Carnes e Aves', 'g', 4.20, 1, 1)`);

// ─── ARTIGOS — RECEITAS BASE ──────────────────────────────────────────────────
await conn.execute(`INSERT IGNORE INTO artigos (id, nome, tipo, categoria, unidadeBase, rendimentoEsperado, validadeProducaoDias, tempoPrepMin, custoMedioPonderado, ativo) VALUES
  (60, 'Molho de pimentos', 'receita_base', 'Molhos', 'g', 800, 5, 30, 0.0035, 1),
  (61, 'Fundo de aves', 'receita_base', 'Caldos', 'ml', 2000, 3, 120, 0.0012, 1),
  (62, 'Sumo de lima', 'receita_base', 'Bases', 'ml', 150, 2, 10, 0.0023, 1),
  (63, 'Tomate concassé', 'receita_base', 'Bases', 'g', 600, 3, 20, 0.0018, 1),
  (64, 'Maionese de alho assado', 'receita_base', 'Molhos', 'g', 400, 5, 25, 0.0045, 1),
  (65, 'Redução de vinho tinto', 'receita_base', 'Molhos', 'ml', 300, 7, 40, 0.0060, 1),
  (66, 'Marinada de piri-piri', 'receita_base', 'Marinadas', 'ml', 500, 7, 15, 0.0028, 1),
  (67, 'Puré de batata', 'receita_base', 'Guarnições', 'g', 1000, 2, 30, 0.0022, 1)`);

// ─── COMPONENTES DAS RECEITAS BASE ────────────────────────────────────────────
const compReceitas = [
  // Molho de pimentos (id=60): pimento vermelho, azeite, alho, cebola
  [60, 13, 500, "g"], [60, 30, 80, "ml"], [60, 10, 20, "g"], [60, 9, 100, "g"],
  // Fundo de aves (id=61): frango, cenoura, aipo, cebola, louro, tomilho
  [61, 1, 1000, "g"], [61, 17, 200, "g"], [61, 18, 100, "g"], [61, 9, 200, "g"], [61, 24, 5, "g"], [61, 23, 3, "g"],
  // Sumo de lima (id=62): lima
  [62, 42, 6, "un"],
  // Tomate concassé (id=63): tomate, azeite, alho
  [63, 11, 800, "g"], [63, 30, 30, "ml"], [63, 10, 10, "g"],
  // Maionese de alho assado (id=64): ovo, azeite, alho, mostarda
  [64, 29, 2, "un"], [64, 30, 200, "ml"], [64, 10, 30, "g"], [64, 44, 10, "g"],
  // Redução de vinho tinto (id=65): vinho tinto, açúcar
  [65, 37, 750, "ml"], [65, 35, 50, "g"],
  // Marinada de piri-piri (id=66): azeite, alho, piri-piri, limão
  [66, 30, 200, "ml"], [66, 10, 40, "g"], [66, 25, 10, "g"], [66, 43, 3, "un"],
  // Puré de batata (id=67): batata, manteiga, natas, sal
  [67, 15, 1200, "g"], [67, 26, 80, "g"], [67, 27, 100, "ml"], [67, 36, 10, "g"],
];

let compOrder = 0;
for (const [receitaId, componenteId, qtd, un] of compReceitas) {
  await conn.execute(
    `INSERT IGNORE INTO receitas_base_componentes (receitaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)`,
    [receitaId, componenteId, qtd, un, compOrder++]
  );
}

// ─── FICHAS TÉCNICAS ──────────────────────────────────────────────────────────
await conn.execute(`INSERT IGNORE INTO fichas_tecnicas (id, nome, descricao, secaoMenu, precoVenda, foodCostAlvo, tempoPrepMin, ativo) VALUES
  (1, 'Bacalhau confitado com puré de batata', 'Bacalhau limpo confitado em azeite, servido com puré de batata cremoso e redução de vinho tinto', 'Principais', 22.50, 30.00, 20, 1),
  (2, 'Frango assado com molho de pimentos', 'Frango limpo assado com marinada de piri-piri e molho de pimentos assados', 'Principais', 16.00, 28.00, 25, 1),
  (3, 'Salmão grelhado com tomate concassé', 'Salmão limpo grelhado com tomate concassé e sumo de lima', 'Principais', 19.50, 32.00, 15, 1),
  (4, 'Lulas recheadas com tomate concassé', 'Lulas limpas recheadas com tomate concassé e ervas', 'Principais', 17.00, 30.00, 35, 1),
  (5, 'Arroz de frango com fundo de aves', 'Arroz cremoso de frango com fundo de aves caseiro', 'Principais', 14.00, 28.00, 30, 1),
  (6, 'Esparguete com molho de tomate concassé', 'Esparguete al dente com tomate concassé e parmesão', 'Massas', 12.50, 25.00, 15, 1),
  (7, 'Piri-piri de frango', 'Frango marinado em piri-piri caseiro, grelhado', 'Principais', 15.00, 28.00, 20, 1),
  (8, 'Lombo de porco com redução de vinho tinto', 'Lombo de porco com redução de vinho tinto e puré de batata', 'Principais', 18.00, 30.00, 25, 1),
  (9, 'Salada de tomate cherry com maionese de alho', 'Tomate cherry em rama com maionese de alho assado', 'Entradas', 8.50, 25.00, 10, 1),
  (10, 'Caldo de galinha com legumes', 'Caldo de galinha caseiro com cenoura e aipo', 'Sopas', 6.50, 20.00, 10, 1),
  (11, 'Bacalhau à Brás', 'Bacalhau limpo desfiado com batata palha, ovo e salsa', 'Principais', 20.00, 30.00, 25, 1),
  (12, 'Frango com molho de pimentos e puré', 'Frango limpo com molho de pimentos e puré de batata', 'Principais', 17.50, 30.00, 20, 1)`);

// ─── COMPONENTES DAS FICHAS TÉCNICAS ──────────────────────────────────────────
const compFichas = [
  // 1. Bacalhau confitado: bacalhau limpo + puré de batata + redução vinho tinto + azeite
  [1, 50, 180, "g"], [1, 67, 200, "g"], [1, 65, 40, "ml"], [1, 30, 30, "ml"],
  // 2. Frango assado: frango limpo + marinada piri-piri + molho de pimentos
  [2, 53, 200, "g"], [2, 66, 50, "ml"], [2, 60, 80, "g"],
  // 3. Salmão grelhado: salmão limpo + tomate concassé + sumo de lima + azeite
  [3, 51, 180, "g"], [3, 63, 100, "g"], [3, 62, 20, "ml"], [3, 30, 20, "ml"],
  // 4. Lulas recheadas: lulas limpas + tomate concassé + salsa
  [4, 52, 200, "g"], [4, 63, 120, "g"], [4, 21, 5, "g"],
  // 5. Arroz de frango: frango limpo + fundo de aves + arroz + cebola
  [5, 53, 150, "g"], [5, 61, 300, "ml"], [5, 32, 80, "g"], [5, 9, 50, "g"],
  // 6. Esparguete: massa + tomate concassé + parmesão + azeite
  [6, 33, 120, "g"], [6, 63, 150, "g"], [6, 28, 20, "g"], [6, 30, 15, "ml"],
  // 7. Piri-piri de frango: frango limpo + marinada piri-piri
  [7, 53, 220, "g"], [7, 66, 60, "ml"],
  // 8. Lombo de porco: lombo + redução vinho tinto + puré de batata
  [8, 3, 200, "g"], [8, 65, 50, "ml"], [8, 67, 180, "g"],
  // 9. Salada tomate cherry: tomate cherry + maionese alho + azeite
  [9, 12, 150, "g"], [9, 64, 40, "g"], [9, 30, 10, "ml"],
  // 10. Caldo de galinha: fundo de aves + cenoura + aipo
  [10, 61, 400, "ml"], [10, 17, 50, "g"], [10, 18, 30, "g"],
  // 11. Bacalhau à Brás: bacalhau limpo + batata + ovo + salsa + azeite
  [11, 50, 160, "g"], [11, 15, 100, "g"], [11, 29, 2, "un"], [11, 21, 5, "g"], [11, 30, 20, "ml"],
  // 12. Frango com molho e puré: frango limpo + molho pimentos + puré batata
  [12, 53, 180, "g"], [12, 60, 80, "g"], [12, 67, 180, "g"],
];

let ftOrder = 0;
for (const [fichaId, componenteId, qtd, un] of compFichas) {
  await conn.execute(
    `INSERT IGNORE INTO fichas_tecnicas_componentes (fichaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)`,
    [fichaId, componenteId, qtd, un, ftOrder++]
  );
}

// ─── MOVIMENTOS INICIAIS (stock de arranque) ──────────────────────────────────
const stockInicial = [
  [1, 3600, 2.80], [2, 2000, 6.50], [3, 2000, 5.20], [4, 1500, 4.80],
  [5, 5000, 9.50], [6, 2000, 12.00], [7, 1500, 7.50], [8, 1000, 8.00],
  [9, 5000, 0.60], [10, 800, 3.50], [11, 3000, 1.20], [12, 1500, 2.80],
  [13, 2000, 1.80], [14, 1000, 1.60], [15, 10000, 0.55], [16, 2000, 1.20],
  [17, 3000, 0.80], [18, 800, 1.50], [19, 1500, 1.40], [20, 1000, 2.20],
  [21, 120, 0.60], [22, 120, 0.60], [23, 300, 8.00], [24, 200, 6.00],
  [25, 300, 12.00], [26, 2000, 6.00], [27, 2000, 1.80], [28, 800, 18.00],
  [29, 60, 0.18], [30, 5000, 4.50], [31, 3000, 1.20], [32, 8000, 0.90],
  [33, 5000, 1.10], [34, 8000, 0.65], [35, 4000, 0.80], [36, 3000, 0.40],
  [37, 3000, 2.50], [38, 3000, 2.20], [39, 2000, 1.50], [40, 2000, 3.20],
  [41, 3000, 1.80], [42, 40, 0.35], [43, 40, 0.25], [44, 600, 5.50], [45, 800, 4.00],
  [50, 2000, 15.83], [51, 1500, 16.00], [52, 1200, 11.25], [53, 1800, 4.20],
  [60, 1600, 0.0035], [61, 4000, 0.0012], [62, 300, 0.0023], [63, 1200, 0.0018],
  [64, 800, 0.0045], [65, 600, 0.0060], [66, 1000, 0.0028], [67, 2000, 0.0022],
];

for (const [artigoId, qtd, custo] of stockInicial) {
  await conn.execute(
    `INSERT INTO movimentos (artigoId, tipo, quantidade, custoUnitario, custoMedioApos, stockApos, documentoTipo, motivo, dataMovimento) VALUES (?, 'entrada_compra', ?, ?, ?, ?, 'seed', 'Stock inicial de arranque', NOW())`,
    [artigoId, qtd, custo, custo, qtd]
  );
  await conn.execute(`UPDATE artigos SET custoMedioPonderado = ? WHERE id = ?`, [custo, artigoId]);
}

await conn.end();
console.log("✅ Seed concluído com sucesso!");
