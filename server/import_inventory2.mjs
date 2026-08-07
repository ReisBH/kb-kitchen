import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Load the pre-extracted JSON
const items = JSON.parse(readFileSync('/tmp/inventory_data.json', 'utf-8'));

// ── 1. Build supplier map ────────────────────────────────────────────────────
// Rules:
// - "já não trabalhamos" → inactive, no link to product
// - "X / Y" → two separate suppliers
// - "makro" / "solbel" appearing as category → treat as supplier

const INACTIVE_MARKERS = ['já não trabalhamos', 'já nao trabalhamos'];

function isInactive(name) {
  return INACTIVE_MARKERS.some(m => name.toLowerCase().includes(m));
}

function cleanSupplierName(name) {
  // Remove parenthetical notes
  return name.replace(/\s*\(.*?\)\s*/g, '').trim();
}

function splitSuppliers(raw) {
  if (!raw) return [];
  // Split on " / "
  return raw.split('/').map(s => s.trim()).filter(Boolean);
}

// Collect all unique supplier names
const supplierSet = new Map(); // cleanName -> { ativo: bool }

for (const item of items) {
  if (!item.fornecedor) continue;
  const parts = splitSuppliers(item.fornecedor);
  for (const part of parts) {
    const inactive = isInactive(part);
    const clean = cleanSupplierName(part);
    if (!clean) continue;
    if (!supplierSet.has(clean)) {
      supplierSet.set(clean, { ativo: !inactive });
    }
  }
}

// Also handle "makro" and "solbel" that appear as categories
for (const item of items) {
  const catLower = (item.categoria || '').toLowerCase();
  if (catLower === 'makro' || catLower === 'solbel') {
    const name = item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1);
    if (!supplierSet.has(name)) {
      supplierSet.set(name, { ativo: true });
    }
  }
}

console.log(`Suppliers to create: ${supplierSet.size}`);

// Insert suppliers
const supplierIdMap = new Map(); // cleanName -> id
for (const [name, { ativo }] of supplierSet) {
  const [result] = await db.execute(
    'INSERT INTO fornecedores (nome, ativo, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
    [name, ativo ? 1 : 0]
  );
  supplierIdMap.set(name, result.insertId);
}
console.log(`✓ ${supplierIdMap.size} suppliers inserted`);

// ── 2. Determine category for each item ─────────────────────────────────────
function resolveCategory(item) {
  const cat = (item.categoria || '').trim();
  const catLower = cat.toLowerCase();
  
  // "makro" / "solbel" as category → use section name instead
  if (catLower === 'makro' || catLower === 'solbel') {
    return item.secao.charAt(0).toUpperCase() + item.secao.slice(1).toLowerCase();
  }
  
  // Normalize
  if (catLower === 'frigorifico') return 'Frigorífico';
  if (catLower === 'congelador') return 'Congelador';
  if (catLower === 'pastelaria') return 'Pastelaria';
  if (catLower === 'armazem') return 'Armazém';
  if (catLower === 'limpeza') return 'Limpeza';
  if (catLower === 'peixaria') return 'Peixaria';
  if (catLower === 'variados') return 'Variados';
  if (catLower === 'japoneses' || catLower === 'japones') return 'Japoneses';
  if (catLower === 'naam' || catLower === 'naam') return 'Naam';
  if (catLower === 'diversos') return 'Diversos';
  
  // Default to section
  const sec = item.secao;
  if (sec === 'FRIGORIFICO') return 'Frigorífico';
  if (sec === 'CONGELADOR') return 'Congelador';
  if (sec === 'PASTELARIA') return 'Pastelaria';
  if (sec === 'ARMAZEM') return 'Armazém';
  if (sec === 'LIMPEZA') return 'Limpeza';
  return cat || 'Outros';
}

// ── 3. Insert artigos ────────────────────────────────────────────────────────
let inserted = 0;
let skipped = 0;
const seen = new Set();

for (const item of items) {
  const nome = item.nome.trim();
  if (!nome || nome.toUpperCase() === 'PRODUTO') { skipped++; continue; }
  
  // Deduplicate by name
  const key = nome.toLowerCase();
  if (seen.has(key)) { skipped++; continue; }
  seen.add(key);
  
  const categoria = resolveCategory(item);
  const unidadeBase = item.unidade_base;
  const unidadeCompra = item.unidade_compra || (unidadeBase === 'g' ? 'kg' : unidadeBase === 'ml' ? 'l' : 'un');
  
  // Determine fornecedorId - use first active supplier
  let fornecedorId = null;
  if (item.fornecedor) {
    const parts = splitSuppliers(item.fornecedor);
    for (const part of parts) {
      const clean = cleanSupplierName(part);
      if (!clean) continue;
      const inactive = isInactive(part);
      if (!inactive) {
        const sid = supplierIdMap.get(clean);
        if (sid) { fornecedorId = sid; break; }
      }
    }
  }
  
  // Also handle "makro"/"solbel" category as supplier
  const catLower = (item.categoria || '').toLowerCase();
  if ((catLower === 'makro' || catLower === 'solbel') && !fornecedorId) {
    const name = item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1);
    fornecedorId = supplierIdMap.get(name) || null;
  }
  
  const custoMedio = item.preco_base > 0 ? item.preco_base : null;
  const stockAtual = item.qty_base;
  
  try {
    await db.execute(
      `INSERT INTO artigos 
        (nome, tipo, categoria, unidadeBase, unidadeCompra, fatorConversao, 
         custoMedioPonderado, stockMinimo, fornecedorId, ativo, requerLimpeza, createdAt, updatedAt)
       VALUES (?, 'ingrediente', ?, ?, ?, 1000, ?, 0, ?, 1, 0, NOW(), NOW())`,
      [nome, categoria, unidadeBase, unidadeCompra, custoMedio, fornecedorId]
    );
    
    // Also insert opening stock movement if qty > 0
    const artigoId = (await db.execute('SELECT LAST_INSERT_ID() as id'))[0][0].id;
    
    if (stockAtual > 0 && custoMedio !== null) {
      await db.execute(
        `INSERT INTO movimentos 
          (artigoId, tipo, quantidade, custoUnitario, stockApos, documentoId, documentoTipo, motivo, createdAt)
         VALUES (?, 'entrada_compra', ?, ?, ?, 'inventario_inicial', 'inventario', 'Stock inicial - Inventário Julho 2026', NOW())`,
        [artigoId, stockAtual, custoMedio, stockAtual]
      );
    }
    
    inserted++;
  } catch (err) {
    console.error(`Error inserting ${nome}:`, err.message);
    skipped++;
  }
}

console.log(`✓ ${inserted} artigos inserted, ${skipped} skipped`);

await db.end();
console.log('Done!');
