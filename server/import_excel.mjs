/**
 * Import script — Fichastecnicas-Pratosnovos2024.xlsx
 * Limpa e reimporta todos os dados do Excel confirmados pelo utilizador
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── INGREDIENTES ─────────────────────────────────────────────────────────────
// Formato: [id, nome, categoria, unidadeBase, unidadeCompra, fatorConversao]
// custoMedioPonderado = 0 (a preencher com faturas reais)
// Todos os artigos em g ou ml ou un conforme aplicável

const ingredientes = [
  // Peixe e marisco
  [1,  "Salmonete limpo",          "Peixe",           "g",  "kg",  1000],
  [2,  "Cabeças e espinhas",       "Peixe",           "g",  "kg",  1000],
  [3,  "Fígado de salmonete",      "Peixe",           "g",  "kg",  1000],
  [4,  "Lírio limpo",              "Peixe",           "g",  "kg",  1000],
  [5,  "Ameijoa limpa",            "Marisco",         "g",  "kg",  1000],
  [6,  "Ameijoa inteira",          "Marisco",         "g",  "kg",  1000],
  [7,  "Enguia limpa",             "Peixe",           "g",  "kg",  1000],
  [8,  "O-Toro",                   "Peixe",           "g",  "kg",  1000],
  [9,  "Negi-toro",                "Peixe",           "g",  "kg",  1000],
  [10, "Ikura",                    "Peixe",           "g",  "kg",  1000],
  [11, "Akami",                    "Peixe",           "g",  "kg",  1000],
  [12, "Gamba Cristal",            "Marisco",         "g",  "kg",  1000],
  [13, "Ostra",                    "Marisco",         "un", "un",  1],
  [14, "Peixe branco",             "Peixe",           "g",  "kg",  1000],
  [15, "Bacalhau em pó",           "Peixe",           "g",  "kg",  1000],
  [16, "Lírio inteiro",            "Peixe",           "g",  "kg",  1000],
  // Carnes
  [17, "Bochecha de vaca",         "Carnes e Aves",   "g",  "kg",  1000],
  [18, "Ossos de vaca",            "Carnes e Aves",   "g",  "kg",  1000],
  [19, "Mão de vaca",              "Carnes e Aves",   "g",  "kg",  1000],
  [20, "Lombo porco preto",        "Carnes e Aves",   "g",  "kg",  1000],
  [21, "Pluma porco preto",        "Carnes e Aves",   "g",  "kg",  1000],
  [22, "Maminha wagyu",            "Carnes e Aves",   "g",  "kg",  1000],
  [23, "Kagoshima wagyu",          "Carnes e Aves",   "g",  "kg",  1000],
  [24, "Air bag de porco",         "Carnes e Aves",   "g",  "kg",  1000],
  // Vegetais e aromáticos
  [25, "Cenoura",                  "Legumes",         "g",  "kg",  1000],
  [26, "Aipo",                     "Legumes",         "g",  "kg",  1000],
  [27, "Alho francês",             "Legumes",         "g",  "kg",  1000],
  [28, "Alho",                     "Legumes",         "g",  "kg",  1000],
  [29, "Cebola",                   "Legumes",         "g",  "kg",  1000],
  [30, "Cebola roxa",              "Legumes",         "g",  "kg",  1000],
  [31, "Cebola queimada",          "Legumes",         "g",  "kg",  1000],
  [32, "Coentros",                 "Ervas",           "g",  "un",  30],
  [33, "Nabo",                     "Legumes",         "g",  "kg",  1000],
  [34, "Enoki",                    "Cogumelos",       "g",  "kg",  1000],
  [35, "Shitake",                  "Cogumelos",       "g",  "kg",  1000],
  [36, "Shimeji",                  "Cogumelos",       "g",  "kg",  1000],
  [37, "Pleurotos",                "Cogumelos",       "g",  "kg",  1000],
  [38, "Paris",                    "Cogumelos",       "g",  "kg",  1000],
  [39, "Cantarelos",               "Cogumelos",       "g",  "kg",  1000],
  [40, "Maçã verde",               "Frutas",          "g",  "kg",  1000],
  [41, "Gengibre",                 "Aromáticos",      "g",  "kg",  1000],
  [42, "Gengibre queimado",        "Aromáticos",      "g",  "kg",  1000],
  [43, "Citronela",                "Aromáticos",      "g",  "kg",  1000],
  [44, "Folha de lima kaffir",     "Aromáticos",      "g",  "kg",  1000],
  [45, "Bimi",                     "Legumes",         "g",  "kg",  1000],
  [46, "Mini milho",               "Legumes",         "g",  "kg",  1000],
  [47, "Rebento de limão",         "Legumes",         "g",  "kg",  1000],
  [48, "Rebentos",                 "Legumes",         "g",  "kg",  1000],
  [49, "Cebolinho",                "Ervas",           "g",  "kg",  1000],
  // Algas e produtos do mar
  [50, "Salicórnia",               "Algas",           "g",  "kg",  1000],
  [51, "Alface do mar",            "Algas",           "g",  "kg",  1000],
  [52, "Alga Nori",                "Algas",           "un", "un",  1],
  [53, "Alga Nori em pó",          "Algas",           "g",  "kg",  1000],
  [54, "Plâncton",                 "Algas",           "g",  "kg",  1000],
  [55, "Caviar oscietra",          "Peixe",           "g",  "kg",  1000],
  [56, "Sementes de wasabi",       "Condimentos",     "g",  "kg",  1000],
  // Condimentos e bases japonesas
  [57, "Dashi",                    "Bases Japonesas", "ml", "l",   1000],
  [58, "Soja sem glúten",          "Bases Japonesas", "ml", "l",   1000],
  [59, "Soja branca",              "Bases Japonesas", "ml", "l",   1000],
  [60, "Sake",                     "Bases Japonesas", "ml", "l",   1000],
  [61, "Mirin",                    "Bases Japonesas", "ml", "l",   1000],
  [62, "Vinagre de arroz",         "Bases Japonesas", "ml", "l",   1000],
  [63, "Xantana",                  "Espessantes",     "g",  "kg",  1000],
  [64, "Agar-Agar",                "Espessantes",     "g",  "kg",  1000],
  [65, "Wasabi",                   "Condimentos",     "g",  "kg",  1000],
  [66, "Wasabi Oroshi",            "Condimentos",     "g",  "kg",  1000],
  [67, "Katakuri ko",              "Bases Japonesas", "g",  "kg",  1000],
  [68, "Farinha de arroz",         "Secos",           "g",  "kg",  1000],
  [69, "Sichimi togarashi",        "Condimentos",     "g",  "kg",  1000],
  [70, "Layu-taberu",              "Condimentos",     "ml", "l",   1000],
  [71, "Yuzu Koshu",               "Condimentos",     "g",  "kg",  1000],
  [72, "Molho de peixe",           "Condimentos",     "ml", "l",   1000],
  [73, "Nikiri",                   "Bases Japonesas", "ml", "l",   1000],
  [74, "Inari",                    "Bases Japonesas", "un", "un",  1],
  [75, "Pasta de trufa branca",    "Condimentos",     "g",  "kg",  1000],
  [76, "Sexy Cebolo",              "Condimentos",     "ml", "l",   1000],
  [77, "Óleo de coentros",         "Óleos",           "ml", "l",   1000],
  [78, "Óleo de cebolo",           "Óleos",           "ml", "l",   1000],
  // Outros
  [79, "Azeite",                   "Óleos",           "ml", "l",   1000],
  [80, "Sal",                      "Condimentos",     "g",  "kg",  1000],
  [81, "Sal Maldon",               "Condimentos",     "g",  "kg",  1000],
  [82, "Pão rústico",              "Secos",           "g",  "kg",  1000],
  [83, "Paprika",                  "Condimentos",     "g",  "kg",  1000],
  [84, "Vinho do Porto branco",    "Bebidas",         "ml", "l",   1000],
  [85, "Vinho branco",             "Bebidas",         "ml", "l",   1000],
  [86, "Vinho tinto",              "Bebidas",         "ml", "l",   1000],
  [87, "Mel",                      "Condimentos",     "g",  "kg",  1000],
  [88, "Açúcar",                   "Secos",           "g",  "kg",  1000],
  [89, "Água de tomate",           "Bases",           "ml", "l",   1000],
  [90, "Gema de ovo",              "Laticínios",      "un", "cx12",12],
  [91, "Limão",                    "Frutas",          "un", "un",  1],
  [92, "Lima",                     "Frutas",          "un", "un",  1],
  [93, "Flor de manjericão",       "Ervas",           "g",  "kg",  1000],
  [94, "Maionese",                 "Condimentos",     "g",  "kg",  1000],
  [95, "Malagueta",                "Condimentos",     "g",  "kg",  1000],
  [96, "Creme de abacate",         "Bases",           "g",  "kg",  1000],
  [97, "Manteiga",                 "Laticínios",      "g",  "kg",  1000],
  [98, "Gel de álcool",            "Outros",          "ml", "l",   1000],
  [99, "Tsukemono maçã",           "Bases Japonesas", "g",  "kg",  1000],
  [100,"Água",                     "Outros",          "ml", "l",   1000],
  [101,"Tare",                     "Bases Japonesas", "ml", "l",   1000],
];

console.log("A inserir ingredientes...");
for (const [id, nome, cat, unBase, unCompra, fator] of ingredientes) {
  await conn.execute(
    `INSERT INTO artigos (id, nome, tipo, categoria, unidadeBase, unidadeCompra, fatorConversao, custoMedioPonderado, ativo)
     VALUES (?, ?, 'ingrediente', ?, ?, ?, ?, 0, 1)`,
    [id, nome, cat, unBase, unCompra, fator]
  );
}
console.log(`  ${ingredientes.length} ingredientes inseridos`);

// ─── RECEITAS BASE ────────────────────────────────────────────────────────────
// IDs a partir de 200
const receitasBase = [
  // [id, nome, categoria, unidadeBase, rendimento, validadeDias]
  [200, "Molho de Fígado",          "Molhos",          "ml",  1000, 3],
  [201, "Gel de Plâncton",          "Bases",           "g",   500,  2],
  [202, "Sunomono de Tomate",       "Bases Japonesas", "ml",  800,  3],
  [203, "Molho Bolhão Pato",        "Molhos",          "ml",  1000, 3],
  [204, "Croutons",                 "Bases",           "g",   500,  7],
  [205, "Cogumelos Mix",            "Bases",           "g",   500,  3],
  [206, "Gema de Ovo Curada",       "Bases",           "g",   200,  5],
  [207, "Unagi Tare",               "Bases Japonesas", "ml",  500,  30],
  [208, "Caldo de Vaca Aromatizado","Caldos",          "ml",  3000, 5],
  [209, "Sukiaky (molho)",          "Bases Japonesas", "ml",  500,  30],
  [210, "Sukiaky de Vaca",          "Bases",           "ml",  1000, 3],
  [211, "Jus Bochecha",             "Molhos",          "ml",  500,  5],
  [212, "Bochecha de Vaca Confitada","Carnes",         "g",   800,  5],
  [213, "Kimchee",                  "Bases Japonesas", "g",   1000, 14],
  [214, "Leche Tigre",              "Bases",           "ml",  500,  2],
  [215, "Crocante de Bacalhau",     "Bases",           "un",  20,   2],
  [216, "Pluma Porco Preto",        "Carnes",          "g",   600,  3],
  [217, "Udon (molho)",             "Bases Japonesas", "ml",  500,  7],
  [218, "Nabo Marinado",            "Bases",           "g",   500,  7],
  [219, "Shari",                    "Bases Japonesas", "g",   1000, 1],
];

console.log("A inserir receitas base...");
for (const [id, nome, cat, unBase, rend, validade] of receitasBase) {
  await conn.execute(
    `INSERT INTO artigos (id, nome, tipo, categoria, unidadeBase, rendimentoEsperado, validadeProducaoDias, custoMedioPonderado, ativo)
     VALUES (?, ?, 'receita_base', ?, ?, ?, ?, 0, 1)`,
    [id, nome, cat, unBase, rend, validade]
  );
}
console.log(`  ${receitasBase.length} receitas base inseridas`);

// ─── COMPONENTES DAS RECEITAS BASE ────────────────────────────────────────────
// [receitaId, componenteId, quantidade, unidade]
const compReceitas = [
  // 200 — Molho de Fígado (rende ~1L)
  [200, 2,  2000, "g"],   // Cabeças e espinhas
  [200, 25, 500,  "g"],   // Cenoura
  [200, 26, 500,  "g"],   // Aipo
  [200, 27, 400,  "g"],   // Alho francês
  [200, 57, 2000, "ml"],  // Dashi
  [200, 79, 60,   "ml"],  // Azeite
  [200, 84, 100,  "ml"],  // Vinho do Porto branco
  [200, 63, 6,    "g"],   // Xantana
  [200, 83, 100,  "g"],   // Paprika
  [200, 3,  120,  "g"],   // Fígado de salmonete

  // 201 — Gel de Plâncton
  [201, 54, 20,   "g"],   // Plâncton
  [201, 100,500,  "ml"],  // Água
  [201, 80, 5,    "g"],   // Sal
  [201, 64, 5,    "g"],   // Agar-Agar

  // 202 — Sunomono de Tomate (rende 800ml)
  [202, 89, 500,  "ml"],  // Água de tomate
  [202, 59, 100,  "ml"],  // Soja branca
  [202, 62, 100,  "ml"],  // Vinagre de arroz
  [202, 57, 100,  "ml"],  // Dashi
  [202, 64, 5,    "g"],   // Agar-Agar

  // 203 — Molho Bolhão Pato (rende 1L)
  [203, 6,  2000, "g"],   // Ameijoa inteira
  [203, 79, 200,  "ml"],  // Azeite
  [203, 28, 30,   "g"],   // Alho
  [203, 32, 20,   "g"],   // Coentros
  [203, 60, 400,  "ml"],  // Sake
  [203, 91, 30,   "g"],   // Limão
  [203, 63, 5,    "g"],   // Xantana

  // 204 — Croutons
  [204, 82, 300,  "g"],   // Pão rústico
  [204, 79, 50,   "ml"],  // Azeite
  [204, 80, 5,    "g"],   // Sal
  [204, 53, 10,   "g"],   // Alga Nori em pó

  // 205 — Cogumelos Mix
  [205, 35, 100,  "g"],   // Shitake
  [205, 36, 100,  "g"],   // Shimeji
  [205, 37, 100,  "g"],   // Pleurotos
  [205, 38, 100,  "g"],   // Paris
  [205, 39, 100,  "g"],   // Cantarelos

  // 206 — Gema de Ovo Curada
  [206, 90, 10,   "un"],  // Gema de ovo

  // 207 — Unagi Tare
  [207, 58, 200,  "ml"],  // Soja sem glúten
  [207, 88, 100,  "g"],   // Açúcar
  [207, 60, 100,  "ml"],  // Sake
  [207, 61, 100,  "ml"],  // Mirin
  // Aparas de enguia — usam ingrediente enguia limpa como proxy
  [207, 7,  100,  "g"],   // Aparas enguia

  // 208 — Caldo de Vaca Aromatizado
  [208, 18, 2000, "g"],   // Ossos de vaca
  [208, 19, 1000, "g"],   // Mão de vaca
  [208, 26, 300,  "g"],   // Aipo
  [208, 25, 300,  "g"],   // Cenoura
  [208, 29, 300,  "g"],   // Cebola
  [208, 100,3000, "ml"],  // Água
  [208, 85, 200,  "ml"],  // Vinho branco
  [208, 80, 20,   "g"],   // Sal
  [208, 31, 100,  "g"],   // Cebola queimada
  [208, 42, 50,   "g"],   // Gengibre queimado
  [208, 43, 50,   "g"],   // Citronela

  // 209 — Sukiaky (molho)
  [209, 58, 200,  "ml"],  // Soja sem glúten
  [209, 88, 100,  "g"],   // Açúcar
  [209, 60, 100,  "ml"],  // Sake
  [209, 61, 100,  "ml"],  // Mirin

  // 210 — Sukiaky de Vaca
  [210, 208,500,  "ml"],  // Caldo de Vaca Aromatizado
  [210, 209,200,  "ml"],  // Sukiaky (molho)

  // 211 — Jus Bochecha
  [211, 57, 500,  "ml"],  // Dashi (proxy para caldo de frango)
  [211, 43, 20,   "g"],   // Citronela
  [211, 44, 5,    "g"],   // Folha de lima kaffir
  [211, 80, 5,    "g"],   // Sal
  [211, 86, 100,  "ml"],  // Vinho tinto
  [211, 87, 30,   "g"],   // Mel

  // 212 — Bochecha de Vaca Confitada
  [212, 17, 1000, "g"],   // Bochecha de vaca
  [212, 80, 10,   "g"],   // Sal
  [212, 57, 500,  "ml"],  // Dashi (proxy caldo frango)
  [212, 43, 20,   "g"],   // Citronela
  [212, 44, 5,    "g"],   // Folha de lima kaffir

  // 213 — Kimchee
  [213, 28, 150,  "g"],   // Alho (confitado)
  [213, 30, 350,  "g"],   // Cebola roxa (chalota assada)
  [213, 40, 180,  "g"],   // Maçã verde
  [213, 72, 50,   "ml"],  // Molho de peixe
  [213, 58, 130,  "ml"],  // Soja sem glúten
  [213, 62, 130,  "ml"],  // Vinagre de arroz
  [213, 68, 60,   "g"],   // Farinha de arroz
  [213, 88, 50,   "g"],   // Açúcar
  [213, 41, 30,   "g"],   // Gengibre
  [213, 69, 15,   "g"],   // Sichimi togarashi

  // 214 — Leche Tigre
  [214, 26, 50,   "g"],   // Aipo
  [214, 30, 50,   "g"],   // Cebola roxa
  [214, 14, 100,  "g"],   // Peixe branco
  [214, 91, 100,  "ml"],  // Limão
  [214, 92, 50,   "ml"],  // Lima
  [214, 32, 10,   "g"],   // Coentros
  [214, 100,200,  "ml"],  // Gelo/Água

  // 215 — Crocante de Bacalhau
  [215, 52, 10,   "un"],  // Folha de arroz (proxy Alga Nori)
  [215, 15, 100,  "g"],   // Bacalhau em pó
  [215, 94, 50,   "g"],   // Maionese
  [215, 95, 10,   "g"],   // Malagueta

  // 216 — Pluma Porco Preto
  [216, 21, 800,  "g"],   // Pluma porco preto
  [216, 96, 100,  "g"],   // Creme de abacate
  [216, 24, 50,   "g"],   // Air bag de porco
  [216, 80, 10,   "g"],   // Sal

  // 217 — Udon (molho)
  [217, 58, 200,  "ml"],  // Soja
  [217, 57, 300,  "ml"],  // Dashi
  [217, 61, 100,  "ml"],  // Mirin

  // 218 — Nabo Marinado
  [218, 33, 500,  "g"],   // Nabo
  [218, 58, 100,  "ml"],  // Soja
  [218, 57, 100,  "ml"],  // Dashi
  [218, 61, 50,   "ml"],  // Mirim
  [218, 88, 30,   "g"],   // Açúcar

  // 219 — Shari (arroz temperado para sushi)
  // Shari é um ingrediente comprado/preparado — sem componentes definidos no Excel
];

console.log("A inserir componentes das receitas base...");
let ordem = 0;
for (const [receitaId, componenteId, qtd, un] of compReceitas) {
  await conn.execute(
    `INSERT INTO receitas_base_componentes (receitaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)`,
    [receitaId, componenteId, qtd, un, ordem++]
  );
}
console.log(`  ${compReceitas.length} componentes de receitas inseridos`);

// ─── FICHAS TÉCNICAS ──────────────────────────────────────────────────────────
// IDs a partir de 300
const fichas = [
  // [id, nome, descricao, secao, precoVenda, foodCostAlvo, tempoPrepMin]
  [300, "Salmonete e Algas",          "Salmonete limpo com salicórnia, alface do mar, molho de fígado e gel de plâncton", "Principais", 0, 30, 20],
  [301, "Akami & Caviar",             "Akami com sunomono de tomate, flor de manjericão e caviar oscietra",               "Sushi",       0, 30, 10],
  [302, "Bolhão Pato",                "Lírio limpo com ameijoa, molho bolhão pato, croutons e óleo de coentros",          "Principais",  0, 30, 15],
  [303, "Unadon",                     "Enguia limpa com cogumelos mix, tare de enguia, gema de ovo curada e shari",       "Donburi",     0, 30, 15],
  [304, "KaisenDon",                  "O-Toro, Ikura, Negi-toro com shari e wasabi",                                      "Donburi",     0, 30, 10],
  [305, "Niku Take Nabe",             "Sukiaky de vaca, caldo de vaca, lombo porco preto, maminha wagyu e cogumelos",     "Principais",  0, 30, 20],
  [306, "Temaki Bochecha de Vaca",    "Bochecha confitada com jus, tsukemono maçã, shari e alga nori",                    "Temaki",      0, 30, 10],
  [307, "Gamba Cristal",              "Gamba cristal com katakuri ko, sal e sichimi togarashi",                           "Principais",  0, 30, 10],
  [308, "Nigiri Enoki Confitado",     "Enoki confitado em azeite com cebolinho e shari",                                  "Nigiri",      0, 30, 5],
  [309, "Nigiri Shitake Sunomono",    "Shitake com sunomono de tomate, wasabi e shari",                                   "Nigiri",      0, 30, 5],
  [310, "Nigiri Milho",               "Mini milho com shari",                                                             "Nigiri",      0, 30, 5],
  [311, "Nigiri Inari",               "Inari com shari",                                                                  "Nigiri",      0, 30, 5],
  [312, "Nigiri Kimchee",             "Shari com kimchee",                                                                "Nigiri",      0, 30, 5],
  [313, "Ostra Leche Tigre",          "Ostra com leche tigre e óleo de cebolo",                                           "Entradas",    0, 30, 5],
  [314, "Nigiri Kagoshima",           "Kagoshima wagyu com nikiri, gema de ovo curada e shari",                           "Nigiri",      0, 30, 5],
  [315, "Sakana Yaki",                "Lírio com tare, manteiga e bimi",                                                  "Principais",  0, 30, 15],
];

console.log("A inserir fichas técnicas...");
for (const [id, nome, desc, secao, preco, fcAlvo, tempo] of fichas) {
  await conn.execute(
    `INSERT INTO fichas_tecnicas (id, nome, descricao, secaoMenu, precoVenda, foodCostAlvo, tempoPrepMin, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, nome, desc, secao, preco, fcAlvo, tempo]
  );
}
console.log(`  ${fichas.length} fichas técnicas inseridas`);

// ─── COMPONENTES DAS FICHAS TÉCNICAS ─────────────────────────────────────────
// [fichaId, componenteId, quantidade, unidade]
// componenteId pode ser ingrediente (1-199) ou receita_base (200-219)
const compFichas = [
  // 300 — Salmonete e Algas
  [300, 1,   20,  "g"],   // Salmonete limpo
  [300, 50,  4,   "g"],   // Salicórnia
  [300, 56,  1,   "g"],   // Sementes de wasabi
  [300, 51,  5,   "g"],   // Alface do mar
  [300, 200, 7,   "g"],   // Molho de Fígado
  [300, 201, 4,   "g"],   // Gel de Plâncton

  // 301 — Akami & Caviar
  [301, 11,  20,  "g"],   // Akami
  [301, 202, 20,  "ml"],  // Sunomono de Tomate
  [301, 93,  1,   "g"],   // Flor de manjericão
  [301, 55,  5,   "g"],   // Caviar oscietra
  [301, 80,  1,   "g"],   // Sal

  // 302 — Bolhão Pato
  [302, 4,   30,  "g"],   // Lírio limpo
  [302, 5,   4,   "g"],   // Ameijoa limpa
  [302, 203, 10,  "ml"],  // Molho Bolhão Pato
  [302, 204, 5,   "g"],   // Croutons
  [302, 77,  2,   "ml"],  // Óleo de coentros
  [302, 47,  2,   "g"],   // Rebento de limão
  [302, 80,  2,   "g"],   // Sal

  // 303 — Unadon
  [303, 7,   80,  "g"],   // Enguia limpa
  [303, 76,  5,   "ml"],  // Sexy Cebolo
  [303, 75,  10,  "g"],   // Pasta de trufa branca
  [303, 205, 15,  "g"],   // Cogumelos Mix
  [303, 207, 15,  "ml"],  // Unagi Tare
  [303, 206, 30,  "g"],   // Gema de Ovo Curada
  [303, 219, 100, "g"],   // Shari

  // 304 — KaisenDon
  [304, 8,   60,  "g"],   // O-Toro
  [304, 10,  50,  "g"],   // Ikura
  [304, 9,   60,  "g"],   // Negi-toro
  [304, 219, 60,  "g"],   // Shari
  [304, 66,  2,   "g"],   // Wasabi Oroshi
  [304, 76,  4,   "ml"],  // Sexy Cebolo

  // 305 — Niku Take Nabe
  [305, 210, 150, "ml"],  // Sukiaky de Vaca
  [305, 208, 150, "ml"],  // Caldo de Vaca Aromatizado
  [305, 20,  20,  "g"],   // Lombo porco preto
  [305, 22,  20,  "g"],   // Maminha wagyu
  [305, 206, 10,  "g"],   // Gema de Ovo Curada
  [305, 70,  5,   "ml"],  // Layu-taberu
  [305, 71,  2,   "g"],   // Yuzu Koshu
  [305, 98,  20,  "ml"],  // Gel de álcool
  [305, 81,  3,   "g"],   // Sal Maldon
  [305, 205, 70,  "g"],   // Cogumelos Mix

  // 306 — Temaki Bochecha de Vaca
  [306, 212, 20,  "g"],   // Bochecha de Vaca Confitada
  [306, 211, 50,  "ml"],  // Jus Bochecha
  [306, 99,  1,   "g"],   // Tsukemono maçã
  [306, 219, 20,  "g"],   // Shari
  [306, 52,  1,   "un"],  // Alga Nori

  // 307 — Gamba Cristal
  [307, 12,  60,  "g"],   // Gamba Cristal
  [307, 67,  10,  "g"],   // Katakuri ko
  [307, 80,  4,   "g"],   // Sal
  [307, 69,  3,   "g"],   // Sichimi togarashi

  // 308 — Nigiri Enoki Confitado
  [308, 34,  10,  "g"],   // Enoki
  [308, 79,  10,  "ml"],  // Azeite
  [308, 49,  1,   "g"],   // Cebolinho
  [308, 219, 9,   "g"],   // Shari

  // 309 — Nigiri Shitake Sunomono
  [309, 35,  10,  "g"],   // Shitake
  [309, 202, 10,  "ml"],  // Sunomono de Tomate
  [309, 65,  1,   "g"],   // Wasabi
  [309, 219, 9,   "g"],   // Shari

  // 310 — Nigiri Milho
  [310, 46,  10,  "g"],   // Mini milho
  [310, 219, 9,   "g"],   // Shari

  // 311 — Nigiri Inari
  [311, 74,  10,  "un"],  // Inari
  [311, 219, 9,   "g"],   // Shari

  // 312 — Nigiri Kimchee
  [312, 219, 9,   "g"],   // Shari
  [312, 213, 12,  "g"],   // Kimchee

  // 313 — Ostra Leche Tigre
  [313, 13,  1,   "un"],  // Ostra
  [313, 214, 20,  "ml"],  // Leche Tigre
  [313, 78,  5,   "ml"],  // Óleo de cebolo
  [313, 48,  2,   "g"],   // Rebentos

  // 314 — Nigiri Kagoshima
  [314, 23,  12,  "g"],   // Kagoshima wagyu
  [314, 73,  9,   "ml"],  // Nikiri
  [314, 206, 3,   "g"],   // Gema de Ovo Curada
  [314, 219, 9,   "g"],   // Shari

  // 315 — Sakana Yaki
  [315, 16,  150, "g"],   // Lírio inteiro
  [315, 101, 15,  "ml"],  // Tare
  [315, 97,  5,   "g"],   // Manteiga
  [315, 45,  30,  "g"],   // Bimi
];

console.log("A inserir componentes das fichas técnicas...");
let ftOrdem = 0;
for (const [fichaId, componenteId, qtd, un] of compFichas) {
  await conn.execute(
    `INSERT INTO fichas_tecnicas_componentes (fichaId, componenteId, quantidade, unidade, ordem) VALUES (?, ?, ?, ?, ?)`,
    [fichaId, componenteId, qtd, un, ftOrdem++]
  );
}
console.log(`  ${compFichas.length} componentes de fichas inseridos`);

await conn.end();
console.log("\n✅ Importação concluída com sucesso!");
console.log(`   ${ingredientes.length} ingredientes`);
console.log(`   ${receitasBase.length} receitas base`);
console.log(`   ${fichas.length} fichas técnicas`);
