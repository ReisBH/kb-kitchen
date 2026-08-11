# Backup Sanitizado da Base de Dados

Este directório contém uma exportação SQL da informação operacional do **KB Kitchen**. A cópia é adequada para reconstituir dados funcionais do sistema num ambiente controlado, mas exclui propositadamente dados de autenticação e privacidade.

| Incluído | Excluído |
|---|---|
| Ingredientes, fornecedores, receitas, fichas técnicas, lotes, movimentos, inventários, vendas, regras de validade e mapas POS | Utilizadores, convites, credenciais locais, hashes de palavras-passe, sessões QR, tokens e ficheiros enviados por OCR |

Para gerar uma nova cópia, execute `node scripts/export-sanitised-db-backup.mjs` com `DATABASE_URL` configurada. A exportação será criada com a data no nome do ficheiro.

> O repositório é privado, mas não deve conter credenciais, variáveis de ambiente ou outros segredos. A separação destes dados reduz o impacto de uma exposição acidental.
