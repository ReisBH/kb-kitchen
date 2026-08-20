# Auditoria final de custos — 20/08/2026

## Cobertura de ligações

| Área | Resultado |
|---|---:|
| Componentes gravados em receitas base | 253 |
| Componentes gravados em fichas técnicas | 272 |
| Componentes gravados ligados a artigos existentes | 525 de 525 |

## Receitas base

| Métrica | Resultado |
|---|---:|
| Receitas base ativas | 104 |
| Com rendimento provisório | 104 |
| Com custo médio positivo | 85 |
| Com custo médio zero | 19 |

Foi associada automaticamente a correspondência inequívoca **Lírio (*Seriola lalandi*) → Lírio Limpo**: 1 000 g do ingrediente Lírio, com custo de 0,025000 €/g. Os 19 custos médios a zero mantêm-se como exceções documentadas: os seus componentes não dispõem de custo médio positivo no catálogo, têm unidade de origem ambígua ou são receitas associadas sem custo de origem. Não foram inventados custos.

> **Cogumelos mix — Semi-elaborado** foi completada manualmente pelo utilizador com 30 g de enoki, 30 g de paris e 30 g de shiitake. O rendimento provisório é 90 g, o custo por lote é 0,9963 € e o custo médio é 11,0700 €/kg.

## Fichas técnicas

| Métrica | Resultado |
|---|---:|
| Fichas técnicas ativas | 128 |
| Com custo calculado positivo no motor de explosão | 94 |
| Com custo calculado zero | 34 |

As 34 fichas sem custo positivo mantêm-se como exceções: utilizam apenas componentes sem custo médio positivo ou não têm componentes com custo disponível. O motor calcula os custos em cascata para todos os componentes vinculados, sem substituir dados ausentes por valores artificiais.

## Controlo de acesso e interface

As páginas de detalhe de receitas base e fichas técnicas apresentam custo unitário e custo total por componente aos perfis **Administrador**, **Head-Chef** e **Sub-Chefe (Chef)**. O backend remove os custos detalhados das respostas de detalhe para o perfil Cozinheiro. Esta regra é coberta por testes de integração.
