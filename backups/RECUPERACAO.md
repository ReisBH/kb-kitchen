# Recuperação do backup KB Kitchen

Este repositório privado contém o código, as migrações Drizzle e uma exportação de dados em `backups/database/latest.json`.

## Recuperar numa base de dados vazia

1. Configure as variáveis privadas listadas em `backups/INVENTARIO_DE_SEGREDOS.md` no ambiente de destino. Os valores não são guardados neste repositório.
2. Instale as dependências com `pnpm install --frozen-lockfile`.
3. Aplique o esquema e todas as migrações com `pnpm drizzle-kit migrate`.
4. Restaure os dados com `node scripts/restore-db-backup.mjs backups/database/latest.json`.
5. Valide com `pnpm exec tsc --noEmit` e `pnpm test` antes de publicar.

> A recuperação substitui todos os dados das tabelas incluídas no ficheiro. Execute-a apenas sobre uma base de dados de recuperação ou depois de criar uma cópia do destino.

## Abrangência

O backup inclui o código da aplicação, a estrutura versionada, as migrações e um retrato dos dados na data indicada no manifesto. Ficheiros e segredos geridos pela plataforma devem ser restaurados também através da cópia de dados da plataforma quando aplicável.
