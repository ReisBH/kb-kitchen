# Estado do backup no GitHub

| Componente | Estado |
| --- | --- |
| Repositório | Privado: `ReisBH/kb-kitchen-backup` |
| Código, migrações e configuração não sensível | Sincronizados |
| Dados da base de dados | Exportação presente em `backups/database/latest.json` |
| Manifesto de tabelas | Presente em `backups/database/MANIFESTO.md` |
| Segredos em ficheiros Git | Nunca incluídos |
| Segredos protegidos do GitHub | Requerem configuração por um titular com permissão para gerir *Actions secrets* |

## Passo final para os segredos

No repositório privado, abrir **Settings → Secrets and variables → Actions → New repository secret** e inserir os nomes listados em `backups/INVENTARIO_DE_SEGREDOS.md`. O valor de cada segredo deve ser copiado de uma fonte segura de configuração; não deve ser enviado para este repositório nem colocado em ficheiros versionados.
