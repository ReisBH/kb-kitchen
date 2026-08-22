import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const [ficheiro] = process.argv.slice(2);
if (!ficheiro) throw new Error("Utilização: node scripts/restore-db-backup.mjs <ficheiro-de-backup.json>");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const dump = JSON.parse(await fs.readFile(ficheiro, "utf8"));
if (dump.formato !== "kb-kitchen-db-backup-v1") throw new Error("Formato de backup não suportado.");

const desserializar = (_key, value) => value?.__tipo === "buffer-base64" ? Buffer.from(value.valor, "base64") : value;
for (const [nome, tabela] of Object.entries(dump.tabelas)) {
  tabela.linhas = JSON.parse(JSON.stringify(tabela.linhas), desserializar);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
await connection.query("SET FOREIGN_KEY_CHECKS = 0");
for (const [nome, tabela] of Object.entries(dump.tabelas)) {
  await connection.query(`TRUNCATE TABLE \`${nome.replaceAll("`", "``")}\``);
  for (const linha of tabela.linhas) await connection.query(`INSERT INTO \`${nome.replaceAll("`", "``")}\` SET ?`, linha);
}
await connection.query("SET FOREIGN_KEY_CHECKS = 1");
await connection.end();
console.log(`Base de dados restaurada a partir de ${ficheiro}.`);
process.exit(0);
