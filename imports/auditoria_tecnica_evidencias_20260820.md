# Evidências de Auditoria Técnica — KB Kitchen

**Data de recolha:** 20/08/2026  
**Âmbito:** arquitetura, sincronização de dados, custos, stock, produção, vendas, OCR/POS, QR/lotes e interface operacional.

## Indicadores da base de dados

| Indicador | Resultado |
|---|---:|
| Artigos ativos | 656 |
| Receitas base ativas | 104 |
| Fichas técnicas ativas | 128 |
| Receitas sem rendimento preenchido | 0 |
| Fichas ativas sem componentes | 23 |
| Componentes de receita órfãos ou inativos | 0 |
| Componentes de ficha órfãos ou inativos | 0 |
| Artigos com stock negativo | 0 |
| Ingredientes ativos sem custo médio | 17 |
| Ingredientes sem custo usados em receitas | 0 |
| Ingredientes sem custo usados em fichas | 0 |
| Itens POS mapeados | 0 |
| Documentos OCR confirmados | 0 |
| Fichas sem preço de venda | 128 |
| Nomes normalizados duplicados de artigos ativos | 4 |
| Componentes repetidos numa mesma receita ou ficha | 0 |
| Lotes ativos | 0 |
| Regras de validade configuradas | 0 |
| Componentes de receitas base | 256 |
| Componentes de fichas técnicas | 272 |
| Produções registadas | 1 |
| Vendas registadas | 0 |

## Evidências no código

| Área | Localização | Evidência observada |
|---|---|---|
| Stock e custo médio | `server/engine/stock.ts:19–107` | O stock atual é derivado do livro de movimentos e as entradas atualizam o custo médio ponderado. O cálculo e a inserção não estão protegidos por uma transação ou bloqueio por artigo. |
| Explosão de fichas e receitas | `server/engine/explosao.ts:52–172` | A árvore é percorrida com consultas por componente; a venda cria movimentos um a um, sem transação de lote ou idempotência global. |
| Produção de receita | `server/routers/receitas.ts:179–239` | Produção consome nós de primeiro nível e cria entrada do subproduto, mas os movimentos não recebem uma chave comum de produção. |
| Rendimento de proteínas | `server/routers/rendimento.ts:82–112` | O valor designado `custoRealPorKg` resulta de custo total dividido por peso limpo em gramas, isto é, €/g; o movimento de entrada divide esse valor novamente por 1 000. Esta inconsistência reduz o custo registado do artigo limpo em 1 000 vezes. |
| Edição de composições | `server/routers/receitas.ts:116–176`; `server/routers/fichas.ts:122–160` | Atualizações apagam componentes e inserem novamente sem transação; uma falha entre operações pode deixar a composição incompleta. |
| Vendas e waste | `server/routers/fichas.ts:162–240` | A venda é criada, explodida e atualizada em passos separados, sem reversão automática se uma linha falhar. |
| Movimentos | `server/routers/movimentos.ts:114–151` | Admin/Head Chef podem editar ou apagar movimentos diretamente, contrariando a natureza append-only do livro e sem recalcular históricos. |
| Inventário | `server/routers/inventario.ts:101–133; 189–214` | O fecho publica ajustes individualmente; a reversão elimina movimentos em vez de criar estornos. |
| OCR/POS | `server/routers/ocr.ts:160–210; 248–338` | Confirmações não são idempotentes nem transacionais; correspondência aproximada usa o primeiro resultado de `LIKE`. |
| QR e lotes | `server/routers/qr.ts:53–153; 287–329` | A saída QR usa idempotência e anulação por movimento inverso. O consumo/descarte de lote altera apenas a tabela de lotes, sem espelhar movimento de stock. |
| Autorização | `server/_core/trpc.ts:12–58` | Existe RBAC base e o Admin é incluído em regras de papel; diversas operações críticas continuam apenas em `protectedProcedure`. |
| Dependências | `pnpm audit --prod` em 20/08/2026 | Foram reportadas 81 vulnerabilidades (1 crítica, 21 altas, 49 moderadas, 10 baixas). Entre os pacotes afetados aparecem `drizzle-orm`, `@trpc/server`, `axios`, `path-to-regexp`, `lodash`, `fast-xml-parser`, `form-data` e `nanoid`. |
| Validação automatizada | `pnpm exec tsc --noEmit && pnpm test` em 20/08/2026 | Compilação TypeScript concluída sem erros; 16 ficheiros de teste e 45 testes aprovados. |

## Casos concretos de qualidade de dados

As 23 fichas sem composição incluem pratos ou agregados como **Bento Kabuki**, **Kabuki Sushi**, **Kagoshima**, **Gohan** e várias entradas de sushi; todas surgem sem preço de venda. Os quatro grupos de nomes normalizados duplicados são `Carvao/Carvão`, `Farinha de amendoa/Farinha de amêndoa`, `Sementes de abobora/Sementes de abóbora` e `Lirio Limpo/Lírio Limpo`; este último atravessa os tipos `receita_base` e `proteina_limpa`.

## Observação de interface

Uma sessão autenticada validou anteriormente os fluxos principais. A captura automatizada de múltiplas rotas desta auditoria ficou no ecrã “A carregar…”, pois esse ambiente de captura não transportou a sessão autenticada; este resultado não foi classificado como falha funcional até ser reproduzido numa sessão autenticada.
