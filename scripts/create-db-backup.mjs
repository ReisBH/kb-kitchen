import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");

const outputDirectory = path.resolve("backups/database");
await fs.mkdir(outputDirectory, { recursive: true });

const connection = await mysql.createConnection(databaseUrl);
const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
const tableKey = Object.keys(tables[0] ?? {}).find((key) => key.startsWith(`Tables_in_`));
if (!tableKey) throw new Error("Não foi possível identificar as tabelas da base de dados.");

const serializar = (_key, value) => {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return { __tipo: "buffer-base64", valor: value.toString("base64") };
  return value;
};

const dump = {
  formato: "kb-kitchen-db-backup-v1",
  criadoEm: new Date().toISOString(),
  tabelas: {},
};

for (const table of tables) {
  const nome = table[tableKey];
  const [[estrutura]] = await connection.query(`SHOW CREATE TABLE \`${nome.replaceAll("`", "``")}\``);
  const [linhas] = await connection.query(`SELECT * FROM \`${nome.replaceAll("`", "``")}\``);
  dump.tabelas[nome] = {
    criar: estrutura["Create Table"],
    linhas,
  };
}

await connection.end();

const id = dump.criadoEm.replaceAll(":", "-").replace(".", "-");
const ficheiro = path.join(outputDirectory, `kb-kitchen-db-${id}.json`);
await fs.writeFile(ficheiro, JSON.stringify(dump, serializar, 2));
await fs.writeFile(path.join(outputDirectory, "latest.json"), JSON.stringify(dump, serializar, 2));

const resumo = Object.entries(dump.tabelas).map(([nome, tabela]) => `- ${nome}: ${tabela.linhas.length} linhas`).join("\n");
await fs.writeFile(path.join(outputDirectory, "MANIFESTO.md"), `# Exportação da base de dados\n\nGerado em: ${dump.criadoEm}\n\n## Tabelas\n\n${resumo}\n`);
console.log(`Exportação criada em ${ficheiro} (${Object.keys(dump.tabelas).length} tabelas).`);
process.exit(0);
