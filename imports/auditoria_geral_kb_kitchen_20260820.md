# Auditoria Geral do KB Kitchen

**Data:** 20 de agosto de 2026  
**Âmbito:** arquitetura, dados mestres, sincronização operacional, segurança, qualidade de código, desempenho e experiência de trabalho em restauração.  
**Base de evidência:** revisão estática do código, consulta apenas de leitura à base de dados, validação TypeScript e suíte automatizada. Não foram alterados dados operacionais durante esta auditoria.

> **Conclusão executiva.** O KB Kitchen já possui uma base funcional muito relevante para um restaurante: catálogo unificado de artigos, custos por média ponderada, receitas base, fichas técnicas, explosão em cascata, rendimento de proteínas, QR, OCR e RBAC. Contudo, o sistema ainda deve ser tratado como **em fase de estabilização operacional**, e não como um livro de stock definitivo: os principais riscos estão no caráter editável do livro de movimentos, na falta de transações atómicas em operações compostas, em dados mestres de fichas incompletos e em integrações OCR/POS ainda sem utilização real. [1] [2]

## 1. Diagnóstico rápido

| Dimensão | Estado | Leitura profissional |
|---|---|---|
| Estrutura funcional | **Forte** | O domínio cobre os fluxos essenciais de compra, stock, produção, receita, ficha, venda, inventário, desperdício e rastreabilidade. |
| Integridade atual dos dados | **Boa, com lacunas** | Não foram encontrados componentes órfãos/inativos nem stock negativo; porém, 23 fichas ativas estão vazias e as 128 fichas ativas não têm preço de venda preenchido. [1] |
| Sincronização entre módulos | **Média** | Há uma origem comum de stock — os movimentos — e a explosão liga ficha/receita/ingrediente. Faltam atomicidade, idempotência transversal e reversões contabilisticamente seguras. [2] [3] |
| Custo e food cost | **Média** | A conversão de rendimento e o custo por grama estão corretos, e ingredientes sem custo não estão em uso. Ainda assim, sem preços de venda, o food cost comercial não pode ser gerido. [1] [4] |
| Segurança e controlo operacional | **Média-baixa** | Existe RBAC, mas algumas operações sensíveis são apenas autenticadas. QR e lotes expõem operações públicas insuficientemente fechadas. [5] [6] |
| Prontidão para volume real | **Média-baixa** | A lista de fichas recalcula custos em cascata a cada leitura e os processos de escrita compostos não usam transações. [3] [7] |
| Qualidade de engenharia | **Média** | TypeScript compila e 45 testes passam, mas não existe evidência de cobertura E2E/concorrência e a auditoria de dependências devolveu 1 vulnerabilidade crítica e 21 altas. [8] [9] |

## 2. Pontos fortes que devem ser preservados

O modelo de domínio parte de uma decisão acertada: ingredientes, receitas base e proteínas limpas são artigos com tipos distintos. Isto reduz a duplicação de entidades e permite que receitas consumam ingredientes ou pré-preparações pelo mesmo mecanismo. As tabelas de componentes ligam receitas e fichas ao catálogo central, enquanto a explosão percorre níveis de receita e calcula o custo nos nós terminais. [1] [3]

O motor de stock também tem uma base coerente. O stock é calculado pela soma de movimentos e as entradas atualizam o custo médio ponderado; esta escolha cria uma trilha de auditoria mais robusta do que guardar apenas um saldo editável. A conversão de unidades concentra regras de peso, volume, densidade e equivalências culinárias, o que é essencial para o custo real de cozinha. [2]

O rendimento de proteínas evoluiu para um desenho seguro: o destino limpo é um artigo `proteina_limpa` associado explicitamente ao artigo bruto por `artigoBrutoId`; a aplicação valida essa associação antes de criar a saída do bruto e a entrada do limpo. Os 18 pares solicitados foram testados pela lógica do seletor. [4] [10]

Há ainda bons sinais de maturidade operacional: o OCR passa por revisão antes da confirmação, o QR de saída usa uma chave de idempotência e anulação por movimento inverso, e o RBAC oculta custos detalhados fora das funções autorizadas. Estes padrões devem ser generalizados para os restantes fluxos. [5] [6]

## 3. Estado dos dados e impactos no restaurante

| Constatação | Evidência atual | Impacto no serviço e na gestão | Ação recomendada |
|---|---:|---|---|
| Fichas técnicas ativas sem componentes | 23 de 128 | O prato pode ser vendido sem consumo de matéria-prima e sem custo real. | Bloquear publicação/venda enquanto a ficha estiver sem composição; classificar agregados de menu que não devem ser vendidos como ficha individual. |
| Fichas sem preço de venda | 128 de 128 | Não existe food cost percentual, margem bruta ou alerta de desvio de preço operacionalmente fiável. | Importar ou preencher preços POS; diferenciar fichas de produção das fichas vendáveis. |
| Mapa POS sem itens | 0 mapeamentos | Um fecho de caixa não pode entrar com correspondência controlada entre item vendido e ficha. | Tornar o mapa POS obrigatório para cada item comercial antes de ativar importação automática. |
| Vendas e OCR confirmados | 0 / 0 | O ciclo de operação real ainda não está validado com volume de serviço. | Fazer piloto controlado de uma semana, com reconciliação diária contra o POS e faturas. |
| Nomes de artigo normalizados duplicados | 4 grupos | Pesquisa, OCR e associação manual podem escolher o artigo errado. | Introduzir nome normalizado único e aliases aprovados; decidir o conflito `Lirio Limpo` entre receita e proteína limpa. |
| Ingredientes ativos sem custo | 17 | Não afetam hoje receitas/fichas, mas podem entrar numa composição futura com custo nulo. | Criar alerta de “artigo sem preço/custo” e impedir publicação de composição que o use. |
| Lotes e regras de validade | 0 lotes / 0 regras | Rastreabilidade e controlo de validade existem no código, mas ainda não produzem valor operacional. | Configurar regras por família e iniciar lotes nos pré-preparos de maior risco. |

Os dados atuais preservam uma boa base de segurança: não há componentes órfãos, componentes repetidos na mesma composição, artigos inativos referenciados nem stock negativo. Isto permite corrigir a camada de processo antes de a operação diária criar dívida de dados. [1]

## 4. Falhas técnicas e correções localizadas

### Prioridade P0 — corrigir antes de tornar o sistema o registo oficial de stock

| Falha | Localização no código | Porque é crítica | Correção objetiva |
|---|---|---|---|
| Livro de movimentos pode ser editado ou apagado | `server/routers/movimentos.ts:114–151` | Alterar uma linha histórica não recalcula `stockApos`, custo médio nem relatórios posteriores; apagar destrói a prova de auditoria. | Remover edição/apagamento físico de movimentos confirmados. Criar `anularMovimento` que grava um **movimento inverso**, liga `movimentoOrigemId`, exige motivo e guarda utilizador/data. Recalcular snapshots apenas por rotina controlada. |
| Custo do produto limpo com unidade incoerente | `server/routers/rendimento.ts:82–112` | `custoLiquido / pesoLimpo` calcula **€/g**, mas é guardado como `custoRealPorKg` e dividido novamente por 1 000 na entrada de stock. Para 1 000 g a 10 €/kg e 800 g limpos, o sistema grava 0,0000125 €/g em vez de 0,0125 €/g. | Calcular `custoRealPorKg = (custoLiquido / pesoLimpo) * 1000`; derivar `custoPorGrama = custoRealPorKg / 1000`; usar este último no movimento. Adicionar teste de regressão com esse caso e verificar histórico já criado. |
| Operações compostas não são atómicas | `stock.ts:50–107`; `receitas.ts:179–239`; `fichas.ts:162–240`; `rendimento.ts:41–145`; `inventario.ts:101–133` | Uma falha após a primeira escrita pode deixar stock consumido sem venda, transformação sem entrada, ou venda sem linhas. | Criar serviço `executarOperacaoStock()` sob `db.transaction()`. Uma venda, produção, rendimento, inventário e confirmação OCR devem ser uma única unidade de trabalho. |
| Sem idempotência transversal | Venda manual, produção, OCR, rendimento e inventário | Reenvio de formulário, clique duplo ou retentativa pode duplicar movimentos. QR já resolve este problema, demonstrando o padrão correto. | Adicionar `operacaoId`/`idCliente` único em `movimentos` e uma tabela `operacoes_stock` com estado `iniciada/confirmada/anulada`. Todas as mutações devem reutilizar o mesmo resultado quando a chave já existir. |
| Vulnerabilidades de dependências | `pnpm audit --prod` | Foram identificadas 81 vulnerabilidades, incluindo 1 crítica e 21 altas; a lista inclui dependências de infraestrutura e de acesso a dados. | Criar branch de atualização, executar `pnpm up --latest` de forma faseada, validar breaking changes e configurar auditoria no CI para bloquear novas vulnerabilidades críticas/altas. [9] |
| Saída QR e consumo de lote públicos | `server/routers/qr.ts:53–115; 287–315` | `pinToken` é opcional e os endpoints são públicos; quem tiver o código pode alterar stock ou quantidade de lote. | Tornar PIN obrigatório, aplicar limitação de tentativas/IP, reduzir validade de sessão e registar utilizador obrigatório. Para lotes, exigir autenticação de sessão ou PIN para toda saída. [6] |

### Prioridade P1 — essencial para sincronização confiável e food cost

| Falha | Localização | Efeito | Correção objetiva |
|---|---|---|---|
| Fichas sem composição e sem preço | Base de dados; `fichas.ts:79–160` | A ficha existe, mas não é um produto operacional calculável. A venda pode produzir custo zero ou receita zero. | Adicionar estados `rascunho`, `em_revisao`, `publicada`, `arquivada`. Exigir pelo menos um componente e preço de venda para `publicada`; permitir fichas de menu/agregados apenas como não-vendáveis. |
| Atualização de receitas/fichas com apagar-e-recriar | `receitas.ts:116–176`; `fichas.ts:122–160` | Falha intermédia pode deixar composição vazia; não existe histórico de versões nem aprovação. | Executar dentro de transação. Criar `receita_versoes` e `ficha_versoes`, com hash da composição, autor, data, estado e motivo. Publicar nova versão sem alterar vendas/produções históricas. |
| Lote não movimenta stock central | `qr.ts:287–329` | Consumir ou descartar lote reduz apenas `quantidadeRestante`; o stock do artigo pode permanecer igual. | Ligar `lotes` a movimentos de consumo/quebra ou criar uma tabela de alocação de lote que seja obrigatoriamente refletida no livro de stock. |
| OCR/POS usa primeiro resultado aproximado | `ocr.ts:304–338` | Um nome semelhante pode ser associado silenciosamente ao ingrediente ou ficha errada e contaminar custo/stock. | Substituir retorno único por lista de candidatos com pontuação. Só permitir confirmação automática com alias/mapeamento exato e confiança alta; exigir revisão humana nos restantes casos. |
| Confirmação OCR sem trava de duplicado | `ocr.ts:160–210; 248–301` | Reconfirmar o mesmo documento pode lançar uma segunda compra ou venda. | Exigir estado `em_revisao`, bloquear `confirmado`, guardar assinatura única por fornecedor+número+data, e usar transação/idempotência. |
| Chaves relacionais sem proteção declarativa | `drizzle/schema.ts` | As relações são IDs inteiros e a integridade depende do código; a auditoria atual encontrou 0 órfãos, mas isto não é garantia futura. | Adicionar foreign keys onde compatível, índices únicos compostos em componentes e verificações de tipo/estado. Manter restrição de não apagar artigos referenciados. |
| Produção não tem documento único | `receitas.ts:201–236` | Cada movimento usa `Date.now()` dentro do ciclo e a entrada não tem o mesmo documento; torna difícil reconciliar um lote. | Criar primeiro um `producaoId`/`operacaoId`; usar o mesmo `documentoId` em todos os consumos e na entrada, e armazenar os IDs dos movimentos. |

### Prioridade P2 — desempenho, controlo e experiência de operação

| Oportunidade | Localização | Plano de melhoria |
|---|---|---|
| Custo de fichas recalculado em cada listagem | `fichas.ts:19–45`; `explosao.ts:52–115` | Guardar `custoCalculado`, `custoVersao` e `calculadoEm` num read model. Invalidar e recalcular apenas quando o custo de um ingrediente, receita ou composição muda. |
| Consultas N+1 na explosão | `explosao.ts:57–78; 91–113` | Carregar componentes e artigos por lote (`IN`) e construir um grafo em memória. Este passo torna a lista de fichas previsível em menus maiores. |
| Sem alerta de qualidade de dados | Dashboard/alertas | Criar painel “Prontidão Operacional”: fichas incompletas, preços em falta, custo zero, POS sem mapa, artigos duplicados, rendimentos sem destino e lotes próximos da validade. |
| Tipos de saída pouco distintos | `movimentos.ts:91–112` | Criar semântica explícita para `transferencia`, `consumo_interno`, `amostra`, `devolucao_fornecedor` e `quebra`; não tratar toda saída manual como quebra. |
| Cobertura de testes limitada a regras isoladas | `server/**/*.test.*` | Acrescentar testes de transação/rollback, idempotência, concorrência, ciclo completo OCR→compra→custo→ficha→venda, inventário e lote. Adicionar E2E autenticado para funções críticas. |

## 5. Arquitetura alvo de sincronização

O sistema deve passar de “vários formulários que escrevem movimentos” para uma **unidade operacional imutável**. A unidade é sempre uma operação de negócio — compra, produção, rendimento, venda, inventário, quebra ou consumo de lote — e não um movimento isolado.

| Camada | Responsabilidade proposta | Regra de sincronização |
|---|---|---|
| Dados mestres | Artigos, aliases, fornecedores, receitas, fichas, unidades, fatores, regras de validade | Alterações publicadas são versionadas e aprovadas; nomes normalizados são únicos dentro do tipo adequado. |
| Operação | `operacoes_stock` | Uma linha por evento de negócio, com chave de idempotência, utilizador, origem, estado e referência externa. |
| Livro de movimentos | Movimentos imutáveis ligados a uma operação | A soma é a única fonte de verdade de stock. Estornos substituem edição/apagamento. |
| Lotes | Alocação por lote ligada a movimento | Toda baixa de lote gera baixa de stock; toda produção gera entrada do lote e do artigo. |
| Custo | Snapshot/materialização de custo por versão | Recalcular em cascata quando muda o custo médio ou a composição publicada; congelar o custo da venda/produção histórica. |
| Relatório | Dashboard e alertas | Ler snapshots e exceções, nunca recalcular toda a árvore para cada carregamento normal. |

## 6. Plano de ação objetivo

### Fase A — Estabilização e proteção do livro de stock (0–5 dias)

| Entrega | Ações concretas | Critério de aceitação |
|---|---|---|
| Livro imutável | Desativar `editar`/`eliminar` para movimentos confirmados; introduzir estorno com ligação à origem. | Não existe `DELETE` de movimento operacional; um estorno deixa saldo correto e trilha completa. |
| Rendimento com unidades corretas | Corrigir cálculo €/kg e €/g, testar cenário de 1 kg bruto → 800 g limpos e auditar quaisquer rendimentos já registados. | O custo por grama do limpo corresponde ao custo total da compra dividido pelos gramas limpos, sem fator 1 000 indevido. |
| Serviço transacional | Implementar `executarOperacaoStock` e migrar venda, produção, rendimento, OCR e fecho de inventário. | Teste de falha simulada não deixa movimentos parciais. |
| Idempotência | Adicionar chave única por operação e adaptar formulários/QR/OCR. | Duplo envio devolve o primeiro resultado sem duplicar stock. |
| Segurança | Atualizar dependências, limitar QR/lotes a PIN obrigatório e aplicar rate limit. | `pnpm audit --prod --audit-level=high` sem severidades crítica/alta, salvo exceções formalmente aceites. |

### Fase B — Dados mestres e fichas publicáveis (1–2 semanas)

| Entrega | Ações concretas | Critério de aceitação |
|---|---|---|
| Saneamento de fichas | Rever as 23 fichas sem componentes; preencher preço/compostos ou marcar como agregadas não-vendáveis. | 100% das fichas publicadas têm componentes, preço e família; exceções são explícitas. |
| Normalização | Criar `nomeNormalizado`, aliases, fusão controlada de duplicados e regra para nomes por tipo. | Pesquisa/OCR não devolve candidato ambíguo sem revisão humana. |
| Workflow de publicação | Adicionar rascunho/revisão/publicação e versões de receita/ficha. | Vendas e produções históricas apontam para uma versão identificável. |
| POS e OCR | Cadastrar mapa POS e aliases prioritários; executar piloto diário controlado. | Pelo menos 95% dos itens do piloto chegam por mapeamento exato; os restantes ficam em revisão. |

### Fase C — Sincronização operacional e lotes (2–3 semanas)

| Entrega | Ações concretas | Critério de aceitação |
|---|---|---|
| Lotes reconciliados | Ligar consumo/descarte a movimentos e rastrear lotes usados nas vendas/produções. | Soma de lotes por artigo concilia com stock elegível, com exceções justificadas. |
| Custos materializados | Criar fila de recálculo por dependência e snapshots de custo por ficha/receita. | A lista de fichas não percorre toda a árvore a cada consulta; alterações propagam-se de forma rastreável. |
| Alertas de qualidade | Expor regras de bloqueio/alerta no dashboard. | Head Chef vê diariamente fichas incompletas, custos nulos, mapeamentos pendentes e validade. |

### Fase D — Operação assistida e validação (4 semanas)

Executar um piloto com uma área do restaurante (por exemplo, sushi) durante cinco dias. Comparar diariamente compras, produção, vendas POS, desperdício, stock teórico e contagem física. Só expandir a operação quando a diferença de inventário estiver dentro da tolerância definida pela gestão, os lançamentos duplicados forem zero e todas as exceções tiverem motivo/documento.

## 7. Ordem recomendada de execução

1. **Corrigir a unidade de custo do rendimento de proteínas e auditar os rendimentos já registados.**
2. **Congelar a edição/apagamento físico de movimentos e implementar estornos.**
3. **Tornar venda, produção, rendimento, OCR e inventário transacionais e idempotentes.**
4. **Corrigir dependências críticas/altas e fechar QR/lotes a PIN obrigatório.**
5. **Completar e publicar corretamente as fichas técnicas, preços e mapeamentos POS.**
6. **Versionar receitas/fichas, reconciliar lotes com movimentos e otimizar cálculos de custo.**

> Esta sequência reduz primeiro o risco de criar dados financeiros e de stock irrecuperáveis; só depois acelera automação e expansão do uso diário.

## Referências

[1]: auditoria_tecnica_evidencias_20260820.md "Evidências de auditoria: indicadores da base de dados"
[2]: ../server/engine/stock.ts "Motor de stock e custo médio ponderado"
[3]: ../server/engine/explosao.ts "Motor de explosão em cascata"
[4]: ../server/routers/rendimento.ts "Rendimentos de proteínas"
[5]: ../server/_core/trpc.ts "Autorização tRPC e RBAC"
[6]: ../server/routers/qr.ts "QR, PIN e lotes"
[7]: ../server/routers/fichas.ts "Fichas técnicas, venda e food cost"
[8]: ../server/routers/receitas.ts "Receitas, produção e componentes"
[9]: ../../terminal_full_output/2026-08-20_13-04-13_785536_59794.txt "Resultado de pnpm audit --prod"
[10]: rendimento_destinos_limpos_20260820.md "Destinos limpos de stock"
