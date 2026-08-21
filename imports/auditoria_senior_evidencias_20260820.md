# Evidências — Auditoria Sénior KB Kitchen

**Data da avaliação:** 20/08/2026  
**Âmbito:** ambiente publicado do KB Kitchen, modelo de dados, código de domínio, segurança, testes, dependências e interface autenticada.

## 1. Indicadores de dados recolhidos

| Indicador | Resultado | Leitura de auditoria |
|---|---:|---|
| Artigos ativos | 656 | Base de catálogo significativa para uma operação de restauração. |
| Artigos ativos com custo médio zero | 17 | Corresponde aos destinos `proteina_limpa` criados; não devem entrar em receitas antes de um rendimento real. |
| Artigos com saldo negativo | 0 | O livro de stock mantém consistência de saldo no estado atual. |
| Receitas base ativas | 104 | Cobertura funcional relevante. |
| Receitas sem componentes | 18 | Itens incompletos que não devem ser usados em produção. |
| Receitas sem rendimento esperado | 0 | Boa cobertura para o cálculo de produção. |
| Fichas técnicas ativas | 128 | Cobertura de menu relevante. |
| Fichas publicadas | 105 | O ciclo de publicação está em uso. |
| Fichas publicadas sem preço de venda | 105 | Lacuna crítica de configuração financeira. |
| Fichas ativas sem componentes | 23 | Devem permanecer em rascunho/revisão até estarem completas. |
| Vendas sem linhas | 0 | Integridade de vendas preservada no estado atual. |
| Mapeamentos POS ativos para fichas não publicadas | 0 | A proteção de POS funciona nos registos existentes. |
| Lotes ativos expirados | 0 | A situação de validade está limpa no momento da avaliação. |
| Componentes com artigo inativo/ausente | 0 | Não foram encontrados órfãos nas receitas ou fichas. |
| Componentes com quantidade inválida | 0 | Não foram encontrados valores zero/negativos nas composições. |
| Lotes ativos sem movimento associado | 0 | Há rastreabilidade de lote no estado atual. |
| Movimentos sem documento | 10 | Principalmente movimentos manuais/importados; exige classificação e motivo obrigatório. |
| Movimentos sem utilizador | 312 | Dívida de rastreabilidade histórica a regularizar como migração. |
| Nomes ativos duplicados após normalização | 4 grupos | Risco de ambiguidade em pesquisa/OCR. |
| Artigos sem stock mínimo positivo | 552 | Os alertas de reposição ainda não são operacionais para a maior parte do catálogo. |
| Artigos sem fornecedor preferencial | 68 | Reduz a capacidade de sugestão de compra e análise de fornecedor. |
| Quebras nos últimos 30 dias | 8 | Há sinal de desperdício a acompanhar; o histórico ainda é curto. |
| Lotes descartados nos últimos 30 dias | 1 | Há evidência de utilização do fluxo de descarte. |
| OCR confirmado/em revisão | 0 / 0 | O fluxo está tecnicamente preparado, mas não validado com volume operacional recente. |

## 2. Validações técnicas

| Verificação | Resultado |
|---|---|
| TypeScript | Concluído sem erros. |
| Testes automatizados | 21 ficheiros, 58 testes aprovados. |
| Validação visual autenticada | Vendas, inventário, supervisão e fichas técnicas avaliados. |
| Dependências de produção | 81 vulnerabilidades: 1 crítica, 21 altas, 49 moderadas, 10 baixas. |

## 3. Evidência de dependências prioritárias

| Pacote | Severidade | Versão instalada | Versão corrigida | Cadeia observada |
|---|---|---|---|---|
| `fast-xml-parser` | Crítica | 5.2.5 | >= 5.3.5 | Via `@aws-sdk/client-s3` e `@aws-sdk/xml-builder`. |
| `@trpc/server` | Alta | 11.6.0 | >= 11.8.0 | Via `@trpc/client` e `@trpc/react-query`. |

> A execução de `pnpm audit --prod --audit-level=high` também revelou que a secção `pnpm` no `package.json` deixa de aplicar `patchedDependencies`/`overrides` na versão atual do gestor de pacotes. Esta situação deve ser tratada antes de confiar em qualquer mitigação por override.

## 4. Evidência de interface

As vistas autenticadas confirmaram uma interface operacional coerente e visualmente legível. Em particular, a página de supervisão apresenta o limiar de inventário, janela de validade, o resumo diário e o indicador de e-mail enviado. A página de fichas mostra, contudo, preços de venda de **0,00 €** e margens negativas para fichas ativas/publicadas, corroborando a lacuna financeira medida na base de dados.

## 5. Fontes internas analisadas

| Fonte | Objetivo |
|---|---|
| `drizzle/schema.ts` | Modelo de dados de artigos, movimentos, vendas, fichas, lotes, OCR, inventário e aprovações. |
| `server/engine/stock.ts` | Livro de movimentos, saldo e custo médio ponderado. |
| `server/engine/explosao.ts` | Explosão de receitas/fichas e custo de venda. |
| `server/routers/fichas.ts` | Publicação, vendas, food cost e permissões. |
| `server/routers/receitas.ts` | Composição e produção aprovada por lote. |
| `server/routers/inventario.ts` | Contagem, ajuste e aprovação crítica. |
| `server/routers/ocr.ts` | Confirmação de faturas/POS e aliases. |
| `server/_core/trpc.ts`, `context.ts`, `localAuth.ts`, `cookies.ts` | Autorização, sessões e autenticação. |
| `terminal_full_output/2026-08-20_23-27-46_773946_59794.txt` | Auditoria de dependências. |
