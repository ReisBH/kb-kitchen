# Economato — Lista de Tarefas

## Esquema de Dados
- [x] Tabela fornecedores
- [x] Tabela artigos (ingredientes, proteínas limpas, receitas base)
- [x] Tabela movimentos (livro de movimentos append-only)
- [x] Tabela receitas_base e receitas_base_componentes
- [x] Tabela fichas_tecnicas e fichas_tecnicas_componentes
- [x] Tabela testes_rendimento (protein yield)
- [x] Tabela inventarios e inventario_linhas
- [x] Tabela vendas e venda_linhas
- [x] Tabela notas_encomenda e notas_encomenda_linhas
- [x] Tabela documentos_ocr (faturas e fechos de caixa)
- [x] Tabela aliases_fornecedor (emparelhamento OCR → artigo)
- [x] Tabela mapa_pos (emparelhamento POS → ficha técnica)
- [x] Aplicar migrações na base de dados

## Backend (tRPC Routers)
- [x] Router fornecedores (CRUD)
- [x] Router artigos (CRUD + stock calculado)
- [x] Router movimentos (criar, listar, filtrar)
- [x] Router testes_rendimento (CRUD + cálculos)
- [x] Router receitas_base (CRUD + custeio em cascata)
- [x] Router producao (registar produção, criar movimentos)
- [x] Router fichas_tecnicas (CRUD + motor de explosão)
- [x] Router vendas (entrada manual + explosão em cascata)
- [x] Router inventario (contagem + desvios + ajustes)
- [x] Router alertas (verificar mínimos + gerar notas de encomenda)
- [x] Router notas_encomenda (CRUD + envio de notificação ao proprietário)
- [x] Router ocr_faturas (upload + extração LLM + revisão + confirmação)
- [x] Router ocr_fecho_caixa (upload + extração LLM + mapa POS + confirmação)
- [x] Router dashboard (KPIs, alertas, movimentos recentes)
- [x] Seed com dados realistas (45 ingredientes, 4 proteínas, 8 receitas base, 12 fichas técnicas)

## Frontend — Layout e Design
- [x] Tokens de design: fundo escuro, acentos dourados, Cormorant Garamond + Hanken Grotesk
- [x] Sidebar de navegação em PT-PT com todos os módulos
- [x] Autenticação via Manus OAuth

## Frontend — Páginas
- [x] Dashboard (KPIs, alertas, food cost, movimentos recentes, gráfico)
- [x] Ingredientes (tabela mestra, filtros, sinalização visual de estado)
- [x] Ficha de ingrediente (histórico de preços em gráfico)
- [x] Fornecedores (CRUD)
- [x] Calculadora de rendimento de proteínas
- [x] Receitas base (lista + registo de produção)
- [x] Detalhe de receita base (componentes + custo)
- [x] Fichas técnicas (tabela com food cost e margem)
- [x] Detalhe de ficha técnica (explosão em cascata visual)
- [x] Entrada manual de vendas (com explosão de stock)
- [x] Livro de movimentos (tabela filtrada por tipo)
- [x] Inventário (contagem + desvios)
- [x] Alertas e encomendas (lista + geração + envio)
- [x] OCR de faturas (upload + revisão + confirmação)
- [x] OCR de fecho de caixa (upload + revisão + mapa POS)

## Testes
- [x] Testes unitários: custo médio ponderado
- [x] Testes unitários: conversão de unidades
- [x] Testes unitários: motor de explosão em cascata
- [x] Testes unitários: deteção de ciclos em receitas
- [x] Testes unitários: cálculo de rendimento de proteínas

## Pendente / Melhorias Futuras
- [x] Auth local: tabela credenciais_locais (username, passwordHash, userId, ativo)
- [x] Auth local: endpoint POST /api/auth/local/login com bcrypt + JWT
- [x] Auth local: endpoint POST /api/auth/local/change-password
- [x] Auth local: página de login com dois separadores (Manus OAuth | Utilizador/Senha)
- [x] Auth local: gestão de credenciais locais na página de Utilizadores (criar/redefinir senha)
- [x] RBAC: Estender schema com 4 roles (admin, head_chef, sub_chefe, cozinheiro) e tabela utilizadores_autorizados
- [x] RBAC: Mapa de permissões por role e proteção de procedures no backend
- [x] RBAC: Página de login dedicada com ecrã de boas-vindas
- [x] RBAC: Proteção de rotas no frontend por role
- [x] RBAC: Sidebar filtrada por permissões do role activo
- [x] RBAC: Página de gestão de utilizadores (Admin) — listar, convidar, desactivar
- [x] RBAC: Página de acesso negado
- [x] Formulário de criação de receitas base com componentes
- [x] Formulário de criação de fichas técnicas com componentes
- [x] Simulador de preço nas fichas técnicas
- [x] Comparador de proteínas lado a lado
- [x] Mapa POS configurável via UI
- [x] Registo de Vendas em lote: lista todos os pratos com campo de quantidade, submissão única
- [x] Entradas e saídas manuais de stock: formulário por ingrediente sem OCR
- [x] OCR: ficha de revisão após leitura da foto antes de confirmar importação
- [x] Livro de Movimentos: edição e exclusão de movimentos (Admin e Head Chef)
- [x] Inventário: alerta de desvios >5% antes de guardar, com lista de desvios destacados
- [x] Backup: criar repositório privado GitHub com código e export sanitizado da base de dados
- [x] Importação: extrair fichas do Excel Produtos_20260814170412_, confirmar individualmente a classificação e importar os registos aprovados
- [x] Importação: registar separadamente os itens classificados como Ingrediente para revisão posterior
- [x] Importação: aplicar os nomes corrigidos pelo utilizador às fichas e receitas confirmadas
- [x] Importação: excluir automaticamente todos os itens das famílias BAR e VINHOS do Excel
- [x] Importação: validar as 360 decisões de classificação, exclusões e renomeações antes de escrever na base de dados
- [x] Importação: resolver colisões de nomes e documentar/excluir componentes sem correspondência segura antes da criação dos registos
- [x] Importação: importar apenas componentes com correspondência segura, sem criar ingredientes novos automaticamente
- [x] Importação: manter e entregar o relatório das linhas de componentes excluídas por falta de correspondência segura
- [x] Importação: criar receitas base sem rendimento esperado provisório e assinalar o preenchimento manual pendente
- [x] Importação: excluir a criação da receita base "Wasabi Fresco" e manter o ingrediente existente inalterado
- [x] Importação: remover a ficha criada a partir do item 23 e manter apenas a ficha técnica do item 294 — Tártaro Toro
- [x] Importação: importar o item 294 com o nome final "Tártaro Toro", mantendo o item 293 como "Tartao Maguro Picante"
- [x] Importação: criar receitas base e fichas técnicas aprovadas com os respetivos componentes
- [x] Importação: verificar as contagens e os custos importados e executar testes de regressão
- [x] Desempenho: garantir que a página de fichas técnicas apresenta prontamente os 128 registos importados sem aguardar cálculos sequenciais de custo
- [x] Desempenho: validar autenticadamente a consulta da página /fichas e confirmar os 128 registos após a otimização em lotes
- [x] Importação: validar explicitamente os custos calculados das receitas base e fichas técnicas importadas e guardar evidência
- [x] Desempenho: validar visualmente a página /fichas em sessão autenticada com os 128 registos carregados
- [x] Importação: validar explicitamente o estado de custo das 104 receitas base sem rendimento preenchido e guardar evidência
- [x] Desempenho: guardar evidência verificável da renderização autenticada da página /fichas com 128 registos
- [x] Desempenho: autenticar uma sessão real no browser e capturar prova verificável da página /fichas com os 128 registos carregados
- [x] Receitas e fichas: permitir edição completa de nome, família, preço e componentes
- [x] Receitas e fichas: adicionar as famílias Cozinha Quente, Sushi e Pastelaria ao fluxo de criação e edição
- [x] Receitas e fichas: disponibilizar pesquisa aproximada por nome e filtro por família nas listas
- [x] Importação: guardar a versão publicada após a validação final
- [x] Importação: auditar explicitamente no ficheiro de classificações todas as renomeações pedidas pelo utilizador e confirmar que ficaram registadas corretamente
- [x] Importação: rever e documentar os casos especiais de exclusão e duplicação no ficheiro final de classificação antes da escrita na base de dados
- [x] Importação: normalizar no ficheiro de classificações as exclusões BAR/VINHOS sem nota padronizada identificadas na auditoria
- [x] Importação: registar uma marcação consistente para todos os casos especiais de duplicação e exclusão antes da escrita na base de dados
