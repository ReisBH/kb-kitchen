import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const excludedTables = new Set([
  "users",
  "utilizadores_autorizados",
  "credenciais_locais",
  "sessoes_pin_qr",
]);

const preferredOrder = [
  "fornecedores",
  "artigos",
  "regras_validade",
  "receitas_base_componentes",
  "fichas_tecnicas",
  "fichas_tecnicas_componentes",
  "producoes",
  "testes_rendimento",
  "lotes",
  "movimentos",
  "inventarios",
  "inventario_linhas",
  "vendas",
  "venda_linhas",
  "notas_encomenda",
  "notas_encomenda_linhas",
  "aliases_fornecedor",
  "mapa_pos",
];

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}

function quoteValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\n", "\\n").replaceAll("\r", "\\r")}'`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está disponível.");

  const database = await mysql.createConnection(process.env.DATABASE_URL);
  const [databaseRows] = await database.query("SELECT DATABASE() AS databaseName");
  const databaseName = databaseRows[0]?.databaseName ?? "kb_kitchen";
  const [tableRows] = await database.query("SHOW TABLES");
  const keyName = `Tables_in_${databaseName}`;
  const tables = tableRows
    .map((row) => row[keyName])
    .filter((name) => typeof name === "string" && !excludedTables.has(name));

  const orderedTables = [
    ...preferredOrder.filter((table) => tables.includes(table)),
    ...tables.filter((table) => !preferredOrder.includes(table)).sort(),
  ];

  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const backupDirectory = path.resolve("backups");
  const outputFile = path.join(backupDirectory, `kb-kitchen-db-sanitised-${date}.sql`);
  const lines = [
    "-- KB Kitchen — Database Backup (sanitised)",
    `-- Exported at ${new Date().toISOString()}`,
    "-- Excluded tables: users, utilizadores_autorizados, credenciais_locais, sessoes_pin_qr.",
    "-- OCR documents and uploaded media are intentionally not part of this Git backup.",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
  ];

  for (const table of orderedTables) {
    const [[createRow]] = await database.query(`SHOW CREATE TABLE ${quoteIdentifier(table)}`);
    const createStatement = createRow["Create Table"];
    const [rows] = await database.query(`SELECT * FROM ${quoteIdentifier(table)}`);

    lines.push(`-- ${table}: ${rows.length} rows`);
    lines.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table)};`);
    lines.push(`${createStatement};`);

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const columnSql = columns.map(quoteIdentifier).join(", ");
      const valuesSql = rows.map((row) => `(${columns.map((column) => quoteValue(row[column])).join(", ")})`).join(",\n");
      lines.push(`INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES\n${valuesSql};`);
    }
    lines.push("");
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 1;", "");
  await fs.mkdir(backupDirectory, { recursive: true });
  await fs.writeFile(outputFile, lines.join("\n"), "utf8");
  await database.end();
  console.log(`Backup sanitizado criado: ${outputFile}`);
  console.log(`Tabelas exportadas: ${orderedTables.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
