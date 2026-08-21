# Auditoria Sénior — KB Kitchen

**Autor:** Manus AI  
**Data:** 20/08/2026  
**Âmbito:** CRM operacional para restauração: stock, inventário, food cost, receitas, fichas técnicas, lotes, OCR, POS, aprovações, notificações, segurança e dados.

## Parecer executivo

O **KB Kitchen** já ultrapassou o nível de protótipo. A arquitetura tem um núcleo operacional sólido: livro de movimentos, custo médio ponderado, explosão de receitas, rastreabilidade por lote, aprovações de segundo utilizador, publicação de fichas, idempotência e notificações de supervisão. A aplicação está especialmente bem encaminhada para uma cozinha profissional que necessita de reduzir desperdício e criar disciplina de produção. [1] [2] [3]

Contudo, não deve ser tratada ainda como uma fonte financeira definitiva de **food cost**. A base contém **105 fichas publicadas sem preço de venda**, o que torna a margem e o food cost exibidos estruturalmente inválidos para esses pratos. Há também 17 artigos `proteina_limpa` com custo médio zero, coerentes com a criação recente dos destinos de rendimento, mas que não podem entrar em fichas sem uma transformação real que lhes atribua custo. [1]

O maior risco tecnológico imediato está na combinação de dependências vulneráveis e de permissões de backend excessivamente amplas. A auditoria de produção encontrou uma vulnerabilidade crítica e 21 altas; em paralelo, várias mutações relevantes de receitas, fichas, vendas, inventários e OCR usam apenas autenticação, sem exigir explicitamente o papel apropriado no backend. A interface restringe rotas, mas essa não é uma fronteira de segurança suficiente contra chamadas diretas à API. [4] [5] [6] [7]

> **Conclusão sénior:** o sistema está apto para operar em modo controlado de cozinha, rastreabilidade e teste de processo. Antes de usar os indicadores de food cost como base de decisão de preço, compras ou bónus, deve executar o plano P0 de preço de venda, autorização de backend e correção de dependências.

## Método e limites

Foram analisados o modelo relacional, motores de domínio, routers tRPC, autenticação, cookies, permissões, dados operacionais, testes automatizados, auditoria de dependências e quatro fluxos autenticados: vendas, inventário, supervisão e fichas técnicas. As métricas foram obtidas por consulta direta apenas de leitura à base de dados. [1]

O ambiente apresenta pouca atividade operacional recente: não há vendas, inventários ou OCR confirmados no período analisado. Assim, a robustez de código e de testes é boa evidência de preparação, mas **não substitui** a validação em serviço real, sob concorrência, com operação diária e reconciliação física. [1]

## Avaliação de maturidade

| Domínio | Avaliação | Parecer |
|---|---:|---|
| Livro de stock e rastreabilidade | **3,5/5** | Movimentos, estorno, idempotência e lotes são bons fundamentos; faltam locks de concorrência, cobertura histórica completa e chaves relacionais físicas. |
| Inventário e controlo de perdas | **3,5/5** | Fecho transacional e segunda aprovação para desvios críticos são fortes; 552 artigos não têm mínimo de stock e diminuem o valor preventivo dos alertas. |
| Receitas, produção e food cost | **2,5/5** | Explosão, rendimento e produção aprovada são robustos; preços de venda em falta tornam o food cost de menu não fiável. |
| Compras, fornecedores e OCR | **3/5** | Há confirmação transacional, aliases e proteção contra duplicação; faltam RBAC estrito, fornecedor preferencial em 68 artigos e volume real de validação OCR. |
| Segurança de aplicação | **2/5** | Há bcrypt, JWT, papéis, HTTPS e segredos fora do código; faltam limitação de tentativas, proteção CSRF, revisão de sessões e correções urgentes de dependências. |
| Proteção de dados e continuidade | **2/5** | Há armazenamento de documentos e rastreabilidade, mas não foi encontrada política de retenção, prova de restauro, inventário de dados pessoais ou registo de acesso a documentos. |
| Experiência operacional | **4/5** | A interface é coerente, de baixo ruído e orientada a tarefas; precisa de exceções financeiras mais visíveis, dashboards de ação e operação móvel de inventário mais rápida. |

## Pontos fortes que devem ser preservados

| Força | Evidência | Valor para o restaurante |
|---|---|---|
| **Livro de movimentos com estorno** | O motor usa movimentos positivos/negativos e a reversão cria um estorno em vez de apagar o facto original. [2] | Preserva rastreabilidade para auditoria, inventário e investigação de desvios. |
| **Idempotência nos fluxos críticos** | Rendimento, vendas, waste, inventário, OCR e produção usam chaves ou documentos para evitar duplicação. [3] [6] [7] | Reduz o risco frequente de duplo clique, rede instável e reenvio de pedidos em cozinha. |
| **Produção aprovada por segundo utilizador** | Pedido de produção, veto a autoaprovação, criação de lote e movimentos são processados em transação. [7] | Separa quem produz de quem valida; protege custo, validade e stock. |
| **Publicação de fichas e controlo POS** | A venda e o POS recusam fichas não publicadas; nenhum mapeamento ativo aponta para ficha não publicada. [1] [6] | Impede que pratos incompletos entrem no canal de venda. |
| **Rastreabilidade por lote** | Não há lote ativo sem movimento associado nem lote ativo expirado na fotografia atual. [1] | Suporta FEFO, descarte, etiqueta e resposta a incidentes de segurança alimentar. |
| **Conversões e rendimento de proteína explícitos** | Há conversão de unidades, rendimento bruto/limpo e transação de transformação. [2] | Evita misturar preço por kg e preço por g, erro muito comum em restauração. |
| **Supervisão operacional** | Limiar configurável, notificações internas, relatório diário e envio Brevo foram implementados. [1] | Concentra exceções críticas sem exigir consulta manual contínua. |
| **Cobertura automatizada relevante** | A compilação TypeScript passou e a suíte contém 58 testes em 21 ficheiros. [1] | Dá uma base de regressão útil para evoluções rápidas. |

## Fragilidades prioritárias

### Prioridade P0 — corrigir antes de confiar em food cost ou abrir mais utilizadores

| Achado | Evidência e impacto | Localização | Correção objetiva | Critério de aceitação |
|---|---|---|---|---|
| **Fichas publicadas sem preço de venda** | As 105 fichas publicadas têm preço `0,00 €`. O custo/dose é calculado, mas margem e food cost aparecem como zero ou negativos; decisões de preço, rentabilidade e menu engineering tornam-se inválidas. [1] | Dados `fichas_tecnicas`; listagem de fichas e venda em `server/routers/fichas.ts`. [6] | Criar lista de remediação; exigir preço positivo no fluxo de publicação; mover para `em_revisao` apenas após validação do responsável, sem apagar histórico; bloquear venda manual sem preço explícito. | 100% das fichas publicadas têm preço > 0 ou uma exceção formal aprovada; food cost e margem não apresentam valores sem receita. |
| **RBAC de backend incompleto** | `criar`/`atualizar` de fichas, receitas, vendas e diversas operações de inventário/OCR usam `protectedProcedure`, permitindo a qualquer utilizador autenticado chamar a API diretamente. [5] [6] [7] | `server/routers/fichas.ts:81-165,202-279`; `receitas.ts:75-185`; `inventario.ts:39-139`; `ocr.ts:160-205,256-300`. | Trocar cada mutação por `roleProcedure` com matriz de operações. Exemplo: cozinheiro pode pedir produção; sub-chefe pode contar; apenas head-chef/admin publica, confirma compra/OCR, fecha inventário e altera preço/custo. | Teste de autorização por papel para cada mutation; chamadas diretas tRPC de papel não autorizado devolvem `FORBIDDEN`. |
| **Dependências de produção vulneráveis** | `pnpm audit --prod` encontrou 1 vulnerabilidade crítica, 21 altas, 49 moderadas e 10 baixas. A crítica está em `fast-xml-parser`; `@trpc/server` também está abaixo da versão corrigida. [1] [4] | `package.json`, `pnpm-lock.yaml`; cadeia AWS SDK/tRPC. | Atualizar AWS SDK e `fast-xml-parser` para a versão corrigida; atualizar tRPC para >= 11.8.0; migrar overrides para a sintaxe atual do pnpm, pois a auditoria indica que a configuração existente é ignorada. | `pnpm audit --prod --audit-level=high` sem vulnerabilidades críticas/altas ou com exceções documentadas e mitigadas. |

### Prioridade P1 — executar nas próximas duas semanas

| Achado | Risco para operação ou segurança | Localização | Correção objetiva |
|---|---|---|---|
| **Cookie `SameSite=None` e ausência de barreira CSRF explícita** | Uma sessão baseada em cookie enviada cross-site aumenta a superfície de CSRF em mutations de stock, preços e inventário. [8] | `server/_core/cookies.ts:42-47`; rotas locais. | Usar `SameSite=Lax` ou `Strict` se a arquitetura permitir; implementar token CSRF por sessão/duplo submit para chamadas de escrita; testar origem cruzada. |
| **Login sem limitação de tentativas** | O login local devolve mensagens neutras e usa bcrypt 12, mas não impõe rate limit, bloqueio temporário ou telemetria de falhas. [9] | `server/localAuth.ts:29-79`. | Aplicar rate limit por IP+utilizador, escalonamento de atraso, bloqueio temporário e alerta de tentativas anómalas. |
| **Sessões JWT não são revogadas por versão** | Uma palavra-passe alterada não invalida explicitamente um JWT local já emitido até ao fim das 12 horas. [9] | `server/localAuth.ts:17-23,82-127,137-160`. | Guardar `sessionVersion`/`passwordChangedAt`; incluí-lo no token e validar a cada pedido, ou manter lista de revogação. |
| **Atualização de composição sem transação** | Receita e ficha apagam componentes e inserem a nova lista em comandos separados; uma falha intermédia pode deixar uma composição vazia. [6] [7] | `fichas.ts:152-163`; `receitas.ts:147-156,178-183`. | Envolver atualização da entidade e substituição de componentes numa única transação; adicionar teste de rollback forçado. |
| **Custo médio ponderado vulnerável a concorrência** | O motor lê stock/custo, calcula e atualiza sem lock de linha. Duas entradas simultâneas podem sobrescrever o custo médio e corromper o food cost. [2] | `server/engine/stock.ts:83-126`. | Aplicar bloqueio `FOR UPDATE`/serialização por artigo ou tabela de saldos materializados com controlo de versão; testar duas entradas concorrentes. |
| **Chaves relacionais apenas lógicas** | O esquema usa muitos `int` sem foreign keys físicas. A aplicação hoje não tem componentes órfãos, mas nada na base impede inserções inconsistentes por scripts, migrações ou falhas futuras. [1] [10] | `drizzle/schema.ts`. | Introduzir FKs gradualmente após auditoria de dados, começando por componentes→artigos, linhas→cabeçalhos, lote→movimento e venda→linhas; criar plano de migração reversível. |
| **Dados mestres insuficientes para compras e alertas** | 552 artigos não têm mínimo de stock positivo; 68 não têm fornecedor preferencial; há 4 grupos de nomes duplicados normalizados. [1] | `artigos`, `fornecedores`, pesquisa/OCR. | Criar fila de completude de dados; exigir mínimo/fornecedor para artigos compráveis; implementar índice único por nome normalizado e processo de fusão. |
| **Destino limpo com custo zero** | Os 17 destinos de proteína limpa precisam de custo via rendimento real. Se forem usados numa receita antes disso, subavaliam custo do prato. [1] | `artigos` tipo `proteina_limpa`; rendimento e fichas. | Adicionar regra de publicação que bloqueia componente com custo zero, salvo exceção aprovada; listar destinos sem primeiro rendimento. |
| **OCR e confirmação de compras demasiado abertos** | Qualquer papel autenticado pode confirmar fatura, criar entradas e gravar aliases, apesar de a interface limitar alguns menus. [7] | `server/routers/ocr.ts:160-205`. | Exigir `head_chef`/admin para confirmação financeira; manter leitura para sub-chefe se necessário; registar aprovador. |
| **Dados de fatura sem ciclo de retenção** | URLs/keys de imagem, dados extraídos, fornecedores e números de documento podem conter dados fiscais e pessoais. Não existe campo de retenção, eliminação, acesso ou classificação. [10] | `documentos_ocr` em `drizzle/schema.ts:447-465`. | Definir inventário de dados, prazo de retenção por tipo documental, eliminação/anonimização, registo de acesso e procedimento de exportação/eliminação de titular. |

### Prioridade P2 — evolução para excelência operacional

| Tema | Situação | Evolução recomendada |
|---|---|---|
| **Versionamento de receitas e fichas** | O custo de venda é fotografado por linha, mas a composição atual substitui a anterior. | Introduzir versão publicada imutável de ficha/receita; ligar venda, produção e lote à versão usada. |
| **Desempenho de explosão** | A explosão faz consultas sequenciais por nó e a profundidade é limitada a 6. [3] | Carregar artigos/componentes por lote, memoizar árvore e pré-calcular custo quando publicar. |
| **Rastreabilidade histórica** | Há 312 movimentos sem utilizador e 10 sem documento, provavelmente históricos/importados. [1] | Fazer migração de classificação: utilizador técnico de importação, documento `saldo_inicial` e motivo obrigatório. |
| **Validade e FEFO** | Não há lotes expirados nem sem validade hoje, uma boa base. [1] | Fazer a escolha de lote por FEFO nas saídas, sugerir prioridade e bloquear consumo de lote expirado sem aprovação. |
| **Gestão de preço** | O preço está no prato, sem política de preço, vigência ou aprovação. | Criar histórico de preço de venda e custo alvo por data, com aprovação e motivo. |
| **KPIs de gestão** | O painel de supervisão dá alertas, mas não há tendência por secção/fornecedor/prato. | Criar painel mensal: food cost real vs alvo, compras, perdas, desvios de inventário, top 10 desperdícios e margem por ficha. |
| **Recuperação de desastre** | Não foi obtida evidência de restauro testado. | Definir RPO/RTO, backup diário, retenção, ensaio trimestral de restauro e checklist de incidente. |

## Análise específica de food cost

O modelo de cálculo é tecnicamente adequado: uma ficha explode componentes até matéria-prima, converte unidades e soma o custo do nível mais baixo. A venda guarda `custoUnitario`, `precoUnitario`, receita, custo e percentagem de food cost, o que preserva um registo financeiro do momento da venda. [3] [6]

O problema é de **governação de dados**, não de fórmula: preço de venda nulo e custos zero de ingredientes em transformação propagam-se corretamente, mas para um resultado economicamente falso. A prioridade não é alterar a fórmula de custo; é introduzir o controlo de dados de entrada.

| Regra de controlo proposta | Dono | Bloqueia venda? |
|---|---|---|
| Ficha publicada deve ter preço de venda > 0 | Head-Chef/Admin | Sim, em venda manual; no POS só aceitar preço externo com discrepância registada. |
| Componente de custo zero requer justificativa | Head-Chef | Sim, salvo artigo explicitamente marcado sem custo. |
| Alteração de preço/food cost alvo entra em revisão | Head-Chef + Admin | Não para o histórico; sim para nova publicação. |
| Produção usa receita publicada/versionada | Produção + aprovador | Sim. |
| Diferença de food cost acima do alvo gera alerta | Supervisão | Não, mas exige análise. |

## Segurança e proteção de dados

### Controlos já presentes

O sistema usa bcrypt com 12 rondas, JWT de 12 horas, cookies `httpOnly`, HTTPS quando o pedido é seguro, dupla autenticação Manus/local e controlo por papéis. A produção e o inventário crítico exigem um segundo aprovador diferente do solicitante. [5] [8] [9]

### Lacunas que exigem decisão de gestão

| Área | Risco | Decisão recomendada |
|---|---|---|
| Autorização | UI e backend não têm a mesma matriz em todas as mutations. | Tratar o backend como fonte de verdade; proibir por papel na procedure, nunca apenas na rota visual. |
| Autenticação | Sem rate limit, MFA e revogação imediata de JWT. | Rate limit imediato; MFA para Admin/Head-Chef em fase seguinte; invalidar sessão ao alterar palavra-passe ou desativar utilizador. |
| Dados pessoais/fiscais | OCR pode guardar imagem de fatura e dados extraídos por tempo indeterminado. | Política de retenção, registo de acesso, exportação/eliminação e acordo com fornecedores de armazenamento/OCR/e-mail. |
| Segredos | Foram usados serviços externos de e-mail e armazenamento. | Segredos só no cofre de ambiente; rotação semestral e imediata para chaves de Resend que deixaram de ser usadas. |
| Dependências | Há vulnerabilidades críticas/altas em produção. | Processo mensal de patch e bloqueio de deploy quando houver severidade crítica sem exceção aprovada. |
| Continuidade | Não há prova de restauração. | Exercício trimestral de recuperação com evidência assinada pelo responsável técnico. |

## Plano de ação recomendado

### Primeiras 48 horas

| Ordem | Ação | Responsável sugerido | Resultado verificável |
|---:|---|---|---|
| 1 | Atualizar dependências críticas e altas, corrigir configuração de overrides pnpm e executar regressão completa. | Desenvolvimento | Auditoria de dependências sem crítico/alto não aceite. |
| 2 | Criar matriz backend de permissões e converter mutations sensíveis de `protectedProcedure` para `roleProcedure`. | Desenvolvimento + Head-Chef | Testes por papel aprovados; cozinheiro não altera preço, OCR, inventário ou venda. |
| 3 | Congelar a utilização analítica de food cost e abrir fila de preço para as 105 fichas publicadas. | Head-Chef + Administração | Cada ficha publicada tem preço válido ou estado `em_revisao`. |
| 4 | Bloquear a publicação de ficha que inclua `proteina_limpa` com custo zero sem exceção formal. | Desenvolvimento + Chefia | Teste de publicação falha no cenário de custo zero. |
| 5 | Rodar chaves de serviços descontinuados e validar lista de segredos ativos. | Administração técnica | Inventário de segredos, dono e data de rotação. |

### Próximas duas semanas

| Ordem | Ação | Localização técnica inicial | Resultado verificável |
|---:|---|---|---|
| 6 | Tornar alterações de receita/ficha atómicas e versionadas. | `server/routers/receitas.ts`, `fichas.ts`, novo modelo de versões. | Não existe intervalo em que a composição fique vazia; venda aponta para versão. |
| 7 | Resolver concorrência do custo médio. | `server/engine/stock.ts`. | Teste concorrente conserva custo e saldo esperados. |
| 8 | Completar stock mínimo, fornecedor preferencial e duplicações normalizadas. | `artigos`, importação e UI de dados mestres. | 95%+ dos artigos compráveis têm mínimo e fornecedor; duplicados resolvidos. |
| 9 | Reconciliar movimentos históricos sem utilizador/documento. | `movimentos`, migração auditável. | 100% dos novos movimentos têm utilizador, origem e documento/motivo; históricos identificados. |
| 10 | Aplicar CSRF/rate limit/revogação de sessão. | `cookies.ts`, `localAuth.ts`, camada HTTP/tRPC. | Testes de CSRF e brute force aprovados. |

### 30 a 90 dias

| Ordem | Ação | Resultado de negócio |
|---:|---|---|
| 11 | Implementar FEFO e recolha móvel de inventário por zona/lote. | Menos desperdício e inventário mais rápido. |
| 12 | Criar KPI mensal de margem, perdas e desvios por família, prato e fornecedor. | Decisão baseada em rentabilidade real. |
| 13 | Estabelecer retenção OCR, backups, RPO/RTO e ensaio de restauro. | Continuidade e conformidade mais demonstráveis. |
| 14 | Integrar POS com reconciliação automática e exceções aprovadas. | Menos erro manual entre sala e cozinha. |

## Recomendação de sequência de implementação

Não recomendo iniciar novas funcionalidades de menu ou automações de compra antes de concluir P0. A sequência mais segura é: **segurança de dependências → RBAC backend → preço e dados mestres → atomicidade/versionamento → reporting e automação**. Esta ordem reduz o risco de automatizar dados errados ou ampliar privilégios indevidos.

## Referências

[1]: [Evidências da Auditoria Sénior — métricas, testes e interface](file:///home/ubuntu/economato/imports/auditoria_senior_evidencias_20260820.md)
[2]: [Motor de stock — movimentos, custo médio e conversão](file:///home/ubuntu/economato/server/engine/stock.ts)
[3]: [Motor de explosão — composição, custo e consumo de venda](file:///home/ubuntu/economato/server/engine/explosao.ts)
[4]: [Auditoria de dependências de produção](file:///home/ubuntu/terminal_full_output/2026-08-20_23-27-46_773946_59794.txt)
[5]: [Camada tRPC, contexto, permissões, autenticação local e cookies](file:///home/ubuntu/economato/server/_core/trpc.ts)
[6]: [Router de fichas técnicas, publicação e vendas](file:///home/ubuntu/economato/server/routers/fichas.ts)
[7]: [Routers de receitas, inventário e OCR](file:///home/ubuntu/economato/server/routers/receitas.ts)
[8]: [Opções de cookie de sessão](file:///home/ubuntu/economato/server/_core/cookies.ts)
[9]: [Autenticação local e JWT](file:///home/ubuntu/economato/server/localAuth.ts)
[10]: [Modelo de dados e entidades operacionais](file:///home/ubuntu/economato/drizzle/schema.ts)
