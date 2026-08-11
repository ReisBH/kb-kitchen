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
- [ ] Formulário de criação de receitas base com componentes
- [ ] Formulário de criação de fichas técnicas com componentes
- [ ] Simulador de preço nas fichas técnicas
- [ ] Comparador de proteínas lado a lado
- [ ] Mapa POS configurável via UI
- [x] Registo de Vendas em lote: lista todos os pratos com campo de quantidade, submissão única
- [x] Entradas e saídas manuais de stock: formulário por ingrediente sem OCR
- [x] OCR: ficha de revisão após leitura da foto antes de confirmar importação
- [x] Livro de Movimentos: edição e exclusão de movimentos (Admin e Head Chef)
- [x] Inventário: alerta de desvios >5% antes de guardar, com lista de desvios destacados
- [x] Backup: criar repositório privado GitHub com código e export sanitizado da base de dados
